const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');

const EMPTY_SHA256 = crypto.createHash('sha256').update('').digest('hex');
function cloudConfigured() {
  return Boolean(process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}
function objectKey(userId, filename) {
  if (!/^\d+$/.test(String(userId)) || path.basename(filename) !== filename || !/^rec-[a-zA-Z0-9._-]+$/.test(filename)) {
    throw new Error('Invalid account or recording key.');
  }
  return `users/${userId}/recordings/${filename}`;
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function hmac(key, value, encoding) { return crypto.createHmac('sha256', key).update(value).digest(encoding); }
function awsEncode(value) { return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`); }
function getTarget(key) {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    const url = new URL(endpoint);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('S3_ENDPOINT must use HTTP or HTTPS.');
    const basePath = url.pathname.replace(/\/$/, '');
    url.pathname = `${basePath}/${awsEncode(bucket)}/${key.split('/').map(awsEncode).join('/')}`;
    return { url, region, host: url.host };
  }
  const url = new URL(`https://${bucket}.s3.${region}.amazonaws.com/${key.split('/').map(awsEncode).join('/')}`);
  return { url, region, host: url.host };
}
function signedHeaders(method, target, payloadHash, extra = {}) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const headers = { host: target.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...extra };
  if (process.env.AWS_SESSION_TOKEN) headers['x-amz-security-token'] = process.env.AWS_SESSION_TOKEN;
  const signedNames = Object.keys(headers).map((key) => key.toLowerCase()).sort();
  const canonicalHeaders = signedNames.map((name) => `${name}:${String(headers[name]).trim().replace(/\s+/g, ' ')}\n`).join('');
  const canonicalRequest = [method, target.url.pathname, target.url.search.slice(1), canonicalHeaders, signedNames.join(';'), payloadHash].join('\n');
  const scope = `${dateStamp}/${target.region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const kDate = hmac(`AWS4${process.env.S3_SECRET_ACCESS_KEY}`, dateStamp);
  const kRegion = hmac(kDate, target.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${process.env.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedNames.join(';')}, Signature=${signature}`;
  const requestHeaders = { ...headers, Authorization: authorization };
  return requestHeaders;
}
function request(method, target, headers, bodyStream) {
  return new Promise((resolve, reject) => {
    const transport = target.url.protocol === 'https:' ? https : http;
    const req = transport.request(target.url, { method, headers }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res);
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk.slice(0, 1000); });
      res.on('end', () => {
        const err = new Error(`S3-compatible storage returned HTTP ${res.statusCode}.`);
        err.statusCode = res.statusCode;
        err.name = res.statusCode === 404 ? 'NoSuchKey' : 'S3RequestError';
        err.responseBody = body;
        reject(err);
      });
    });
    req.on('error', reject);
    if (bodyStream) bodyStream.on('error', reject).pipe(req);
    else req.end();
  });
}
async function fileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
async function putRecording({ userId, filename, filePath, contentType }) {
  if (!cloudConfigured()) throw new Error('Cloud storage is selected but S3 is not configured. Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.');
  const key = objectKey(userId, filename);
  const target = getTarget(key);
  const payloadHash = await fileHash(filePath);
  const extra = { 'content-type': contentType || 'application/octet-stream' };
  if (process.env.S3_SERVER_SIDE_ENCRYPTION) extra['x-amz-server-side-encryption'] = process.env.S3_SERVER_SIDE_ENCRYPTION;
  const headers = signedHeaders('PUT', target, payloadHash, extra);
  headers['Content-Length'] = String((await fs.promises.stat(filePath)).size);
  await request('PUT', target, headers, fs.createReadStream(filePath));
  return { key, backend: 's3-compatible' };
}
async function headRecording({ userId, filename }) {
  if (!cloudConfigured()) throw new Error('Cloud storage is selected but S3 is not configured.');
  const target = getTarget(objectKey(userId, filename));
  const response = await request('HEAD', target, signedHeaders('HEAD', target, EMPTY_SHA256));
  return { exists: true, contentLength: Number(response.headers['content-length']) || undefined, contentType: response.headers['content-type'] };
}
async function getRecordingStream({ userId, filename }) {
  if (!cloudConfigured()) throw new Error('Cloud storage is selected but S3 is not configured.');
  const target = getTarget(objectKey(userId, filename));
  const response = await request('GET', target, signedHeaders('GET', target, EMPTY_SHA256));
  return { Body: response, ContentType: response.headers['content-type'], ContentLength: Number(response.headers['content-length']) || undefined };
}
async function deleteRecording({ userId, filename }) {
  if (!cloudConfigured()) throw new Error('Cloud storage is selected but S3 is not configured.');
  const target = getTarget(objectKey(userId, filename));
  await request('DELETE', target, signedHeaders('DELETE', target, EMPTY_SHA256));
}
async function checkConnection() {
  if (!cloudConfigured()) return { configured: false, connected: false };
  const target = getTarget('');
  // A bucket-level HEAD is signed against the bucket endpoint.
  if (process.env.S3_ENDPOINT) target.url.pathname = `${target.url.pathname.replace(/\/$/, '')}`;
  else target.url = new URL(`https://${process.env.S3_BUCKET}.s3.${target.region}.amazonaws.com/`);
  target.host = target.url.host;
  await request('HEAD', target, signedHeaders('HEAD', target, EMPTY_SHA256));
  return { configured: true, connected: true };
}
module.exports = { cloudConfigured, putRecording, headRecording, getRecordingStream, deleteRecording, checkConnection, objectKey };
