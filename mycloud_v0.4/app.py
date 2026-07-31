from flask import Flask, render_template, request, redirect, url_for, send_from_directory, session, flash, jsonify, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename
from authlib.integrations.flask_client import OAuth
from email.message import EmailMessage
from datetime import timedelta
import mysql.connector
import os
import smtplib
import ssl
import secrets
import uuid
import datetime
import threading
import time
import math
import mimetypes
import re
import random
import zipfile
import io
import shutil


app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
app.secret_key = os.getenv('SECRET_KEY', 'mycloud_secret_key')

app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID', '')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET', '')

app.config['GITHUB_CLIENT_ID'] = os.getenv('GITHUB_CLIENT_ID', '')
app.config['GITHUB_CLIENT_SECRET'] = os.getenv('GITHUB_CLIENT_SECRET', '')

db_config = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'password'),
    'database': os.getenv('DB_NAME', 'mycloud_db')
}

email_config = {
    'sender_email': os.getenv('SENDER_EMAIL', ''),
    'sender_password': os.getenv('SENDER_PASSWORD', '')
}

#Initialize OAuth
oauth = OAuth(app)

#Google
oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

#Github
oauth.register(
    name='github',
    client_id=app.config['GITHUB_CLIENT_ID'],
    client_secret=app.config['GITHUB_CLIENT_SECRET'],
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'},
)

# Configure upload folder and create it if it doesn't exist
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

PFP_FOLDER = 'uploads/pfps'
app.config['PFP_FOLDER'] = PFP_FOLDER
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}

# Functions

# Core app and Database functions (1/2)
@app.context_processor
def utility_processor():
    def get_file_icon(filename):
        if not filename or '.' not in filename:
            return 'fa-file'
        
        ext = filename.rsplit('.', 1)[1].lower()
        
        icons = {
            'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
            'pdf': ['pdf'],
            'word': ['doc', 'docx'],
            'excel': ['xls', 'xlsx', 'csv'],
            'powerpoint': ['ppt', 'pptx'],
            'code': ['html', 'css', 'js', 'py', 'java', 'c', 'cpp', 'php', 'sql', 'json', 'xml', 'md'],
            'archive': ['zip', 'rar', '7z', 'tar', 'gz'],
            'audio': ['mp3', 'wav', 'ogg'],
            'video': ['mp4', 'avi', 'mov', 'mkv']
        }
        
        for icon_type, extensions in icons.items():
            if ext in extensions:
                return f'fa-file-{icon_type}'
                
        return 'fa-file'
        
    return dict(get_file_icon=get_file_icon)

def get_db_connection():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as err:
        print(f"Error connecting to MySQL: {err}")
        return None

# Core app and Database functions (2/2)
def run_stash_cleanup():
    while True:
        try:
            conn = get_db_connection()
            if conn:
                cursor = conn.cursor(dictionary=True)
                
                cursor.execute("SELECT id, filename, user_id FROM files WHERE is_stashed = 1 AND stash_expiry_at <= NOW()")
                expired_files = cursor.fetchall()

                for file in expired_files:
                    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(file['user_id']))
                    file_path = os.path.join(user_folder, file['filename'])
                    
                    if os.path.exists(file_path):
                        os.remove(file_path)

                    cursor.execute("DELETE FROM files WHERE id = %s", (file['id'],))
                    conn.commit()

                conn.close()
        except Exception as e:
            print(f"Stash cleanup error: {e}")

        time.sleep(30)


# Helper functions (1/13)
def send_verification_email(receiver_email, verification_token):
    subject = "myCloud Email Verification"
    body = f"Thank you for registering with myCloud! Please click the link below to verify your email address: http://127.0.0.1:5000/verify/{verification_token}"

    em = EmailMessage()
    em['From'] = email_config['sender_email']
    em['To'] = receiver_email
    em['Subject'] = subject
    em.set_content(body)

    context = ssl.create_default_context()

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as smtp:
            smtp.login(email_config['sender_email'], email_config['sender_password'])
            smtp.send_message(em)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

# Helper functions (2/13)
def send_password_reset_email(receiver_email, reset_token):
    subject = "myCloud Password Reset Request"
    body = f"You requested a password reset. Please click the link below to set a new password. This link is valid for 1 hour.\n\n" \
           f"http://127.0.0.1:5000/reset_password/{reset_token}\n\n" \
           f"If you did not request this, please ignore this email."

    em = EmailMessage()
    em['From'] = email_config['sender_email']
    em['To'] = receiver_email
    em['Subject'] = subject
    em.set_content(body)

    context = ssl.create_default_context()

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as smtp:
            smtp.login(email_config['sender_email'], email_config['sender_password'])
            smtp.send_message(em)
        return True
    except Exception as e:
        print(f"Error sending password reset email: {e}")
        return False
    
# Helper functions (3/13)
def calculate_account_age(creation_date):
    if creation_date is None:
        return "Immortal" # The easter egg for old accounts

    now = datetime.datetime.now()
    age = now - creation_date
    
    seconds = age.total_seconds()
    minutes = seconds / 60
    hours = minutes / 60
    days = hours / 24
    months = days / 30.44 # Average days in a month
    years = days / 365.25 # Account for leap years

    if seconds < 60:
        return "Just now"
    elif minutes < 60:
        return f"{int(minutes)} minutes ago"
    elif hours < 24:
        return f"{int(hours)} hours ago"
    elif days < 30.44:
        return f"{int(days)} days ago"
    elif months < 12:
        return f"{int(months)} months ago"
    else:
        years_int = int(years)
        remaining_months = int((years - years_int) * 12)
        return f"{years_int} years, {remaining_months} months ago"
    
# Helper functions (4/13)
def get_total_storage_used(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Sum the file_size for all files belonging to the user
        cursor.execute("SELECT SUM(file_size) as total_size FROM files WHERE user_id = %s", (user_id,))
        result = cursor.fetchone()
        conn.close()

        total_bytes = int(result['total_size']) if result['total_size'] else 0
        return format_file_size(total_bytes)
    except Exception as e:
        print(f"Error calculating storage usage: {e}") 
        return "N/A"
    
# Helper functions (5/13)
def format_file_size(size_bytes):
    if size_bytes == 0:
        return "0 Bytes"
    size_name = ("Bytes", "KB", "MB", "GB", "TB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_name[i]}"

# Helper functions (6/13)
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# Helper functions (7/13)
def get_unique_name(cursor, user_id, parent_folder_id, name, item_type='file'):
    """
    Checks if a file or folder name exists in a directory and returns a unique name.
    Appends (1), (2), etc., to the name if a duplicate is found.
    """
    original_name = name
    base_name, extension = os.path.splitext(name)
    counter = 1
    
    while True:
        if item_type == 'file':
            # Check for existing file with the same name in the same folder
            query = "SELECT id FROM files WHERE user_id = %s AND folder_id <=> %s AND original_filename = %s"
            cursor.execute(query, (user_id, parent_folder_id, name))
        else: # item_type == 'folder'
            # Check for existing folder with the same name in the same parent folder
            query = "SELECT id FROM folders WHERE user_id = %s AND parent_id <=> %s AND name = %s"
            cursor.execute(query, (user_id, parent_folder_id, name))

        if not cursor.fetchone():
            return name  # The name is unique, return it
        
        # If a duplicate is found, generate a new name
        name = f"{base_name} ({counter}){extension}"
        counter += 1

# Helper functions (8/13)
def get_item_path(cursor, item_id, item_type):
    """
    Generates a string representing the full path of a file or folder.
    e.g., "My Cloud / Documents / Reports"
    """
    path_parts = []
    if item_type == 'file':
        cursor.execute("SELECT folder_id FROM files WHERE id = %s", (item_id,))
        result = cursor.fetchone()
        current_folder_id = result['folder_id'] if result else None
    else: # item_type == 'folder'
        cursor.execute("SELECT parent_id FROM folders WHERE id = %s", (item_id,))
        result = cursor.fetchone()
        current_folder_id = result['parent_id'] if result else None

    while current_folder_id is not None:
        cursor.execute("SELECT name, parent_id FROM folders WHERE id = %s", (current_folder_id,))
        folder = cursor.fetchone()
        if folder:
            path_parts.insert(0, folder['name'])
            current_folder_id = folder['parent_id']
        else:
            break
    
    path_parts.insert(0, 'My Cloud')
    return ' / '.join(path_parts)

# Helper functions (9/13)
def get_folder_hierarchy(cursor, user_id, parent_id=None, prefix=""):
    """
    A recursive helper function to get a flat list representing a folder hierarchy,
    with each folder's name showing its full absolute path.
    """
    cursor.execute(
        "SELECT id, name FROM folders WHERE user_id = %s AND parent_id <=> %s ORDER BY name ASC",
        (user_id, parent_id)
    )
    folders = cursor.fetchall()
    
    folder_list = []
    for folder in folders:
        # Construct the display name with the correct prefix
        display_name = f"{prefix}{folder['name']}"
        folder_list.append({'id': folder['id'], 'name': display_name})
        
        # Pass the new, longer prefix down to the children
        folder_list.extend(get_folder_hierarchy(cursor, user_id, folder['id'], prefix=f"{display_name} / "))
        
    return folder_list

# Helper functions (10/13)
def create_notification(user_id, message, link_url=None):
    """Adds a new notification for a user to the database."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO notifications (user_id, message, link_url) VALUES (%s, %s, %s)",
            (user_id, message, link_url)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        # In a real application, you might want to log this error
        print(f"Error creating notification: {e}")

# Helper functions (11/13)
def find_or_create_path(cursor, user_id, parent_folder_id, path_parts):
    """
    Recursively finds or creates a folder path and returns the final folder_id.
    """
    if not path_parts:
        return parent_folder_id
    
    current_part = path_parts[0]
    remaining_parts = path_parts[1:]
    
    # Check if a folder with this name already exists in the current parent
    cursor.execute(
        "SELECT id FROM folders WHERE user_id = %s AND parent_id <=> %s AND name = %s",
        (user_id, parent_folder_id, current_part)
    )
    folder = cursor.fetchone()
    
    if folder:
        # Folder exists, use its ID as the new parent
        new_parent_id = folder['id']
    else:
        # Folder does not exist, create it
        unique_name = get_unique_name(cursor, user_id, parent_folder_id, current_part, 'folder')
        cursor.execute(
            "INSERT INTO folders (user_id, name, parent_id) VALUES (%s, %s, %s)",
            (user_id, unique_name, parent_folder_id)
        )
        new_parent_id = cursor.lastrowid
        
    return find_or_create_path(cursor, user_id, new_parent_id, remaining_parts)

# Helper functions (12/13)
def get_folder_stats_recursive(cursor, folder_id):
    """
    Helper function to recursively get the total size for a folder.
    """
    total_size = 0
    
    # Get size of files directly in the current folder
    cursor.execute(
        "SELECT SUM(file_size) as size FROM files WHERE folder_id <=> %s",
        (folder_id,)
    )
    result = cursor.fetchone()
    if result and result['size']:
        total_size += int(result['size'])

    # Get sub-folders and recurse
    cursor.execute("SELECT id FROM folders WHERE parent_id <=> %s", (folder_id,))
    sub_folders = cursor.fetchall()
    for sub_folder in sub_folders:
        total_size += get_folder_stats_recursive(cursor, sub_folder['id'])
    
    return total_size

# Helper functions (13/13)
def is_descendant(cursor, folder_id, potential_parent_id):
    """
    Helper function to check if a folder is a descendant of another folder
    to prevent moving a folder into itself or its own subfolder.
    """
    current_id = potential_parent_id
    while current_id is not None:
        if current_id == folder_id:
            return True
        cursor.execute("SELECT parent_id FROM folders WHERE id = %s", (current_id,))
        result = cursor.fetchone()
        current_id = result['parent_id'] if result else None
    return False


# Routes and Functions

# User Authentication Routes and Functions (1/2)
# Standard Authentication Routes and Functions (1/6)
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        identifier = request.form['username']
        password = request.form['password']

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users WHERE username = %s OR email = %s", (identifier, identifier,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user['password'], password):
            if user['is_verified'] == 1:
                session['loggedin'] = True
                session['id'] = user['id']
                session['username'] = user['username']
                session['name'] = user['name']
                session['profile_pic'] = user['profile_pic']
                return redirect(url_for('home'))
            else:
                flash('Your account is not verified. Please check your email.', 'error')
                return redirect(url_for('login'))
        else:
            flash('Incorrect username or password.', 'error')
            return redirect(url_for('login'))

    return render_template('login.html')

# Standard Authentication Routes and Functions (2/6)
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form['name']
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            flash('Passwords do not match. Please try again.', 'error')
            return redirect(url_for('register'))

        errors = []
        if len(password) < 8:
            errors.append("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", password):
            errors.append("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("Password must contain at least one special character.")

        if errors:
            for error in errors:
                flash(error, 'error')
            return redirect(url_for('register'))
        
        hashed_password = generate_password_hash(password)
        verification_token = secrets.token_urlsafe(32)

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM users WHERE username = %s OR email = %s", (username, email,))
            existing_user = cursor.fetchone()

            if existing_user:
                flash('Username or email already exists! Please login.', 'error')
                return redirect(url_for('login'))

            cursor.execute("INSERT INTO users (name, username, email, password, verification_token) VALUES (%s, %s, %s, %s, %s)", (name, username, email, hashed_password, verification_token))
            conn.commit()
            conn.close()
            
            if send_verification_email(email, verification_token):
                flash('Registration successful! Please check your email to verify your account.', 'success')
            else:
                flash('Registration successful, but we could not send a verification email. Please contact support.', 'error')

            return redirect(url_for('login'))

        except mysql.connector.Error as err:
            flash(f"Error: {err}", 'error')
            return redirect(url_for('register'))

    return render_template('register.html')

# Standard Authentication Routes and Functions (3/6)
@app.route('/logout')
def logout():
    session.pop('loggedin', None)
    session.pop('id', None)
    session.pop('username', None)
    session.pop('name', None)
    session.pop('google_token', None) 
    return redirect(url_for('login'))

# Standard Authentication Routes and Functions (4/6)
@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form['email']
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user:
            # Generate token and expiry
            reset_token = secrets.token_urlsafe(32)
            expiry_time = datetime.datetime.now() + timedelta(hours=1)
            
            # Store token and expiry in the database
            cursor.execute("UPDATE users SET reset_token = %s, reset_token_expiry = %s WHERE id = %s",
                           (reset_token, expiry_time, user['id']))
            conn.commit()
            
            # Send the email
            send_password_reset_email(user['email'], reset_token)

        # Show a generic message for security reasons (not revealing which emails are registered)
        flash('If an account with that email exists, a password reset link has been sent.', 'success')
        conn.close()
        return redirect(url_for('login'))

    return render_template('forgot_password.html')

# Standard Authentication Routes and Functions (5/6)
@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE reset_token = %s AND reset_token_expiry > NOW()", (token,))
    user = cursor.fetchone()

    if not user:
        flash('Password reset link is invalid or has expired.', 'error')
        conn.close()
        return redirect(url_for('login'))

    if request.method == 'POST':
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('reset_password.html', token=token)

        # Secure password policy check
        errors = []
        if len(password) < 8:
            errors.append("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", password):
            errors.append("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("Password must contain at least one special character.")

        if errors:
            for error in errors:
                flash(error, 'error')
            return render_template('reset_password.html', token=token)

        hashed_password = generate_password_hash(password)
        cursor.execute("UPDATE users SET password = %s, reset_token = NULL, reset_token_expiry = NULL WHERE id = %s",
                       (hashed_password, user['id']))
        conn.commit()
        conn.close()
        
        flash('Your password has been updated successfully. Please log in.', 'success')
        return redirect(url_for('login'))
        
    conn.close()
    return render_template('reset_password.html', token=token)

# Standard Authentication Routes and Functions (6/6)
@app.route('/verify/<token>')
def verify_email(token):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users WHERE verification_token = %s", (token,))
        user = cursor.fetchone()
        
        if user:
            if user['is_verified'] == 1:
                flash('Your account is already verified. You can now log in.', 'success')
                return redirect(url_for('login'))

            cursor.execute("UPDATE users SET is_verified = 1 WHERE verification_token = %s", (token,))
            conn.commit()
            conn.close()

            flash('Email successfully verified! You can now log in.', 'success')
            return redirect(url_for('login'))
        else:
            flash('Invalid or expired verification link.', 'error')
            return redirect(url_for('register'))

    except mysql.connector.Error as err:
        flash(f"Database error: {err}", 'error')
        return redirect(url_for('register'))

# User Authentication Routes and Functions (2/2)
# OAuth Routes and Functions (1/5)
@app.route('/google_login')
def google_login():
    # The URL where Google will redirect the user back to
    redirect_uri = url_for('authorize', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

# OAuth Routes and Functions (2/5)
@app.route('/authorize') # Google's callback
def authorize():
    token = oauth.google.authorize_access_token()
    userinfo = oauth.google.parse_id_token(token, nonce=session.get('_google_nonce'))
    return handle_oauth_login(userinfo.get('name'), userinfo.get('email'), 'google')

# OAuth Routes and Functions (3/5)
@app.route('/github_login')
def github_login():
    redirect_uri = url_for('github_authorize', _external=True)
    return oauth.github.authorize_redirect(redirect_uri)

# OAuth Routes and Functions (4/5)
@app.route('/github/authorize') # GitHub's callback
def github_authorize():
    token = oauth.github.authorize_access_token()
    user_info = oauth.github.get('user').json()
    user_emails = oauth.github.get('user/emails').json()
    
    primary_email = None
    for email_info in user_emails:
        if email_info['primary'] and email_info['verified']:
            primary_email = email_info['email']
            break
            
    name = user_info.get('name') or user_info.get('login')
    return handle_oauth_login(name, primary_email, 'github')

# OAuth Routes and Functions (5/5)
def handle_oauth_login(name, email, provider):
    """
    Generic function to handle user login/registration after OAuth success.
    """
    if not email:
        flash(f'Could not retrieve a unique identifier from {provider}. Please try again.', 'error')
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if not user:
        # If the user's name is None, use their email prefix as a fallback
        if not name:
            name = email.split('@')[0]
            
        # For the username, we can use the name for the first time,
        # but we might want a more robust way to handle duplicate names later.
        username = name
        
        cursor.execute(
            "INSERT INTO users (name, username, email, oauth_provider, is_verified) VALUES (%s, %s, %s, %s, %s)",
            (name, username, email, provider, 1)
        )
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

    session['loggedin'] = True
    session['id'] = user['id']
    session['username'] = user['username']
    session['name'] = user['name']
    session['profile_pic'] = user['profile_pic']
    
    conn.close()
    return redirect(url_for('home'))


# Main page Routes and Functions (1/4)
@app.route('/')
def home():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    # 1. Get current folder ID from URL query parameter (e.g., /?folder_id=1)
    # Defaults to None, which we'll use to represent the root directory.
    current_folder_id = request.args.get('folder_id', None, type=int)

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # --- Base user info (same as before) ---
        cursor.execute("SELECT created_at FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        account_age = calculate_account_age(user['created_at']) if user else 'Unknown'
        storage_used_str = get_total_storage_used(user_id)

        # 2. Fetch sub-folders for the current folder view
        if current_folder_id is None:
            # Query for top-level folders
            cursor.execute("SELECT id, user_id, name FROM folders WHERE user_id = %s AND parent_id IS NULL", (user_id,))
        else:
            # Query for sub-folders
            cursor.execute("SELECT id, user_id, name FROM folders WHERE user_id = %s AND parent_id = %s", (user_id, current_folder_id))
        folders = cursor.fetchall()

        # 3. Fetch files for the current folder view
        if current_folder_id is None:
            # Query for files in the root directory
            sql_query = "SELECT id, original_filename, user_id FROM files WHERE user_id = %s AND folder_id IS NULL AND is_stashed = 0"
            params = (user_id,)
        else:
            # Query for files in a specific folder
            sql_query = "SELECT id, original_filename, user_id FROM files WHERE user_id = %s AND folder_id = %s AND is_stashed = 0"
            params = (user_id, current_folder_id)
        cursor.execute(sql_query, params)
        files = cursor.fetchall()

        # 5. Fetch all top-level folders
        cursor.execute("SELECT id, name FROM folders WHERE user_id = %s AND parent_id IS NULL", (user_id,))
        root_folders = cursor.fetchall()
        # 6. Fetch all top-level files
        cursor.execute("SELECT id, original_filename FROM files WHERE user_id = %s AND folder_id IS NULL AND is_stashed = 0", (user_id,))
        root_files = cursor.fetchall()

        # 5. Generate breadcrumb navigation
        breadcrumbs = []
        folder_id_for_breadcrumbs = current_folder_id
        while folder_id_for_breadcrumbs is not None:
            cursor.execute("SELECT id, name, parent_id FROM folders WHERE id = %s AND user_id = %s", (folder_id_for_breadcrumbs, user_id))
            parent_folder = cursor.fetchone()
            if parent_folder:
                # Insert at the beginning to build the path from root to current
                breadcrumbs.insert(0, {'id': parent_folder['id'], 'name': parent_folder['name']})
                folder_id_for_breadcrumbs = parent_folder['parent_id']
            else:
                # Invalid folder or access denied, break the loop
                break

        folder_hierarchy = get_folder_hierarchy(cursor, user_id, prefix="My Cloud / ")

        conn.close()

        # 6. Pass all the new data to the template
        return render_template('home.html', 
                               folders=folders,
                               files=files, 
                               username=session['username'], 
                               active_page='mycloud', 
                               account_age=account_age, 
                               storage_used=storage_used_str,
                               breadcrumbs=breadcrumbs,
                               current_folder_id=current_folder_id,
                               all_folders=folder_hierarchy,
                               root_folders=root_folders, # <-- Add this new parameter
                               root_files=root_files,
                               folder_hierarchy=folder_hierarchy)
            
    except Exception as e:
        flash(f"Error fetching data: {e}", 'error')
        return redirect(url_for('login'))

# Main page Routes and Functions (2/4)
@app.route('/stash_page')
def stash_page():
    if 'loggedin' not in session:
        return redirect(url_for('login'))
    
    user_id = session['id']
    search_query = request.args.get('q', '')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT created_at FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        account_age = calculate_account_age(user['created_at']) if user else 'Unknown'
        storage_used_str = get_total_storage_used(user_id)

        # Fetch files
        sql_query = "SELECT id, original_filename, stash_expiry_at FROM files WHERE user_id = %s AND is_stashed = 1"
        params = (user_id,)
        if search_query:
            sql_query += " AND original_filename LIKE %s"
            params += (f"%{search_query}%",)
        cursor.execute(sql_query, params)
        files = cursor.fetchall()
        
        conn.close()

        return render_template('stash.html', files=files, username=session['username'], 
                            active_page='stash', search_query=search_query, 
                            account_age=account_age, 
                            storage_used=storage_used_str)
    except Exception as e:
        flash(f"Error fetching stashed files: {e}", 'error')
        return redirect(url_for('home'))
    
# Main page Routes and Functions (3/4)
@app.route('/shared_files')
def shared_files():
    if 'loggedin' not in session:
        token = request.args.get('token')
        if token:
            session['pending_share_token'] = token
        return redirect(url_for('login'))

    user_id = session['id']
    token_to_process = request.args.get('token') or session.pop('pending_share_token', None)
    
    # These will be passed to the template
    file_from_link = None
    folder_from_link = None 

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # --- Logic for incoming share link ---
    if token_to_process:
        # First, try to find a file link
        query = """
            SELECT f.id, f.original_filename, f.file_size, u.name as owner_name
            FROM share_links sl JOIN files f ON sl.file_id = f.id JOIN users u ON f.user_id = u.id
            WHERE sl.token = %s
        """
        cursor.execute(query, (token_to_process,))
        file_from_link = cursor.fetchone()
        
        if file_from_link:
            file_from_link['file_size_formatted'] = format_file_size(file_from_link['file_size'])
        else:
            # If no file link, try to find a folder link
            query = """
                SELECT fo.id, fo.name, u.name as owner_name
                FROM folder_share_links fsl JOIN folders fo ON fsl.folder_id = fo.id JOIN users u ON fo.user_id = u.id
                WHERE fsl.token = %s
            """
            cursor.execute(query, (token_to_process,))
            folder_from_link = cursor.fetchone()
            if folder_from_link:
                 # We can add size calculation here later if needed
                 folder_from_link['size_formatted'] = "N/A"

    # --- Logic to fetch header data (Account Age, Storage Used) ---
    storage_used_str = get_total_storage_used(user_id)
    account_age = "N/A"
    cursor.execute("SELECT created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    if user and user.get('created_at'):
        account_age = calculate_account_age(user['created_at'])

    # --- Logic to fetch the list of all files shared with the user ---
    query = """
        SELECT 
            f.id, 
            f.original_filename,
            f.file_size,
            s.shared_at,
            u.name as shared_by_name
        FROM file_shares s
        JOIN files f ON s.file_id = f.id
        JOIN users u ON f.user_id = u.id
        WHERE s.shared_with_user_id = %s
        ORDER BY s.shared_at DESC
    """
    cursor.execute(query, (user_id,))
    shared_files_list = cursor.fetchall()

    folders_query = """
        SELECT fo.id, fo.name, s.shared_at, u.name as shared_by_name
        FROM folder_shares s
        JOIN folders fo ON s.folder_id = fo.id
        JOIN users u ON fo.user_id = u.id
        WHERE s.shared_with_user_id = %s
        ORDER BY s.shared_at DESC
    """
    cursor.execute(folders_query, (user_id,))
    shared_folders_list = cursor.fetchall()
    conn.close()

    # --- Pass all data to the template ---
    return render_template('shared_files.html', 
                           shared_files=shared_files_list,
                           shared_folders=shared_folders_list, 
                           file_from_link=file_from_link,
                           folder_from_link=folder_from_link,
                           active_page='shared_files',
                           storage_used=storage_used_str,
                           account_age=account_age)

# Main page Routes and Functions (4/4)
@app.route('/share_file/<int:file_id>', methods=['POST'])
def share_file(file_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    share_with_email = request.form.get('email')
    owner_id = session['id']

    if not share_with_email:
        flash('You must enter an email address to share with.', 'error')
        return redirect(request.referrer or url_for('home'))

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT id FROM users WHERE email = %s", (share_with_email,))
    user_to_share_with = cursor.fetchone()

    if not user_to_share_with:
        flash(f'No user found with the email address "{share_with_email}".', 'error')
        conn.close()
        return redirect(request.referrer)

    shared_with_user_id = user_to_share_with['id']

    if shared_with_user_id == owner_id:
        flash('You cannot share a file with yourself.', 'error')
        conn.close()
        return redirect(request.referrer)

    try:
        # CORRECTED INSERT to include the owner's user_id
        cursor.execute(
            "INSERT INTO file_shares (user_id, file_id, shared_with_user_id) VALUES (%s, %s, %s)",
            (owner_id, file_id, shared_with_user_id)
        )
        conn.commit()
        flash('File shared successfully!', 'success')
        cursor.execute("SELECT name FROM users WHERE id = %s", (owner_id,))
        owner_name = cursor.fetchone()['name']
        cursor.execute("SELECT original_filename FROM files WHERE id = %s", (file_id,))
        file_name = cursor.fetchone()['original_filename']
        create_notification(shared_with_user_id, f"'{owner_name}' shared the file '{file_name}' with you.", url_for('shared_files'))
    except mysql.connector.IntegrityError:
        flash('This file has already been shared with that user.', 'info')
    except Exception as e:
        flash(f'An error occurred: {e}', 'error')
    
    conn.close()
    return redirect(request.referrer)

# Home page Routes and Functions (5/5)
@app.route('/shared/<int:folder_id>')
def browse_shared_folder(folder_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Recursive Access Check
    # This query travels UP the folder tree from the requested folder (f1)
    # until it finds a parent (f2) that is directly shared with the user.
    access_query = """
        WITH RECURSIVE FolderPath AS (
            SELECT id, parent_id, user_id
            FROM folders
            WHERE id = %s
            UNION ALL
            SELECT f.id, f.parent_id, f.user_id
            FROM folders f
            INNER JOIN FolderPath fp ON f.id = fp.parent_id
        )
        SELECT f1.id, f1.name, f1.parent_id, f1.user_id
        FROM folders f1
        WHERE f1.id = %s AND (
            -- Either the user owns the folder
            f1.user_id = %s
            -- Or the user has a share record for this folder or any of its parents
            OR EXISTS (
                SELECT 1
                FROM FolderPath fp
                JOIN folder_shares fs ON fs.folder_id = fp.id
                WHERE fs.shared_with_user_id = %s
            )
        )
    """
    cursor.execute(access_query, (folder_id, folder_id, user_id, user_id))
    folder = cursor.fetchone()

    if not folder:
        flash("Folder not found or you do not have access.", "error")
        conn.close()
        return redirect(url_for('shared_files'))

    # The rest of the function remains the same as it correctly fetches
    # contents and builds breadcrumbs based on the verified folder.
    
    # 2. Fetch sub-folders for the current folder view
    cursor.execute("SELECT id, name, user_id FROM folders WHERE parent_id = %s", (folder_id,))
    folders = cursor.fetchall()
    # 3. Fetch files for the current folder view
    cursor.execute("SELECT id, original_filename, user_id FROM files WHERE folder_id = %s AND is_stashed = 0", (folder_id,))
    files = cursor.fetchall()

    # 4. Generate breadcrumb navigation
    breadcrumbs = []
    parent_id = folder['parent_id']
    breadcrumbs.insert(0, {'id': folder['id'], 'name': folder['name'], 'is_shared': True})
    while parent_id is not None:
        cursor.execute("SELECT id, name, parent_id FROM folders WHERE id = %s", (parent_id,))
        parent_folder = cursor.fetchone()
        if parent_folder:
            breadcrumbs.insert(0, {'id': parent_folder['id'], 'name': parent_folder['name'], 'is_shared': True})
            parent_id = parent_folder['parent_id']
        else:
            break
            
    # 5. Fetch common data for the header and modals
    cursor.execute("SELECT created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone() # Result is consumed
    account_age = calculate_account_age(user['created_at']) if user else 'Unknown'
    storage_used_str = get_total_storage_used(user_id)
    
    # This is where the error occurred
    folder_hierarchy = get_folder_hierarchy(cursor, user_id)
    all_folders = folder_hierarchy
    root_folders = [] 
    root_files = []

    conn.close()
    
    # Render the home.html template with ALL the necessary data
    return render_template('home.html',
                           folders=folders,
                           files=files,
                           breadcrumbs=breadcrumbs,
                           current_folder_id=folder_id,
                           account_age=account_age,
                           storage_used_str=storage_used_str,
                           all_folders=all_folders,
                           root_folders=root_folders,
                           root_files=root_files,
                           folder_hierarchy=folder_hierarchy,
                           active_page='shared_files')


# File action Routes and Functions (1/23)
@app.route('/share_folder/<int:folder_id>', methods=['POST'])
def share_folder(folder_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    share_with_email = request.form.get('email')
    owner_id = session['id']

    if not share_with_email:
        flash('You must enter an email address to share with.', 'error')
        return redirect(request.referrer or url_for('home'))

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT id FROM users WHERE email = %s", (share_with_email,))
    user_to_share_with = cursor.fetchone()

    if not user_to_share_with:
        flash(f'No user found with the email address "{share_with_email}".', 'error')
        conn.close()
        return redirect(request.referrer)

    shared_with_user_id = user_to_share_with['id']

    if shared_with_user_id == owner_id:
        flash('You cannot share a folder with yourself.', 'error')
        conn.close()
        return redirect(request.referrer)

    try:
        cursor.execute(
            "INSERT INTO folder_shares (user_id, folder_id, shared_with_user_id) VALUES (%s, %s, %s)",
            (owner_id, folder_id, shared_with_user_id)
        )
        conn.commit()
        flash('Folder shared successfully!', 'success')
        cursor.execute("SELECT name FROM users WHERE id = %s", (owner_id,))
        owner_name = cursor.fetchone()['name']
        cursor.execute("SELECT name FROM folders WHERE id = %s", (folder_id,))
        folder_name = cursor.fetchone()['name']
        create_notification(shared_with_user_id, f"'{owner_name}' shared the folder '{folder_name}' with you.", url_for('shared_files'))
    except mysql.connector.IntegrityError:
        flash('This folder has already been shared with that user.', 'info')
    except Exception as e:
        flash(f'An error occurred: {e}', 'error')
    
    conn.close()
    return redirect(request.referrer)

# File action Routes and Functions (2/23)
@app.route('/add_folder_share_from_token', methods=['POST'])
def add_folder_share_from_token():
    if 'loggedin' not in session:
        return redirect(url_for('login'))
        
    user_id = session['id']
    token = request.form.get('token')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT fsl.folder_id, f.user_id as owner_id
        FROM folder_share_links fsl JOIN folders f ON fsl.folder_id = f.id
        WHERE fsl.token = %s
    """, (token,))
    link_data = cursor.fetchone()

    if not link_data:
        flash("Invalid or expired share link.", "error")
        conn.close()
        return redirect(url_for('shared_files'))

    folder_id = link_data['folder_id']
    owner_id = link_data['owner_id']

    # Prevent user from accepting a share for their own folder
    if owner_id == user_id:
        flash("You cannot accept a share for a folder you already own.", "info")
        conn.close()
        return redirect(url_for('shared_files'))
    
    try:
        cursor.execute(
            "INSERT INTO folder_shares (user_id, folder_id, shared_with_user_id) VALUES (%s, %s, %s)",
            (owner_id, folder_id, user_id)
        )
        conn.commit()
        flash("Folder successfully added to your Shared list!", "success")
    except mysql.connector.IntegrityError:
        flash("This folder is already in your shared list.", "info")
    except Exception as e:
        flash(f"An error occurred: {e}", "error")
    
    conn.close()
    return redirect(url_for('shared_files'))

# File action Routes and Functions (3/23)
@app.route('/upload', methods=['POST'])
def upload_file():
    is_ajax = any(key.startswith('file|') for key in request.files)
    if 'loggedin' not in session:
        return jsonify({'error': 'Not logged in'}), 401 if is_ajax else redirect(url_for('login'))

    user_id = session['id']
    destination_folder_id_str = request.form.get('destination_folder_id')
    destination_folder_id = int(destination_folder_id_str) if destination_folder_id_str and destination_folder_id_str.isdigit() else None
    
    user_folder_path = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
    if not os.path.exists(user_folder_path):
        os.makedirs(user_folder_path)

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        files_uploaded_count = 0
        last_uploaded_name = ""

        if is_ajax:
            # --- Method 1: Handle Drag-and-Dropped Folders/Files ---
            for key, file in request.files.items():
                if not key.startswith('file|'): continue

                full_path = key.split('|', 1)[1]
                path_parts = [part for part in full_path.split('/') if part]
                
                original_filename = path_parts[-1]
                folder_path_parts = path_parts[:-1]
                
                target_folder_id = find_or_create_path(cursor, user_id, destination_folder_id, folder_path_parts)
                
                unique_display_name = get_unique_name(cursor, user_id, target_folder_id, original_filename, 'file')
                file_extension = os.path.splitext(unique_display_name)[1]
                unique_filename = str(uuid.uuid4()) + file_extension
                file_path = os.path.join(user_folder_path, unique_filename)
                
                # Standardized file save and size calculation
                file.seek(0, os.SEEK_END)
                file_size_bytes = file.tell()
                file.seek(0)
                file.save(file_path)

                cursor.execute(
                    "INSERT INTO files (user_id, filename, original_filename, file_size, folder_id) VALUES (%s, %s, %s, %s, %s)",
                    (user_id, unique_filename, unique_display_name, file_size_bytes, target_folder_id)
                )
                files_uploaded_count += 1
                last_uploaded_name = unique_display_name
        else:
            # --- Method 2: Handle Standard Form Uploads ---
            uploaded_files = request.files.getlist('file')
            
            # Check if there is at least one file with a non-empty filename
            has_valid_file = False
            for file in uploaded_files:
                if file.filename != '':
                    has_valid_file = True
                    break
            
            if not uploaded_files or not has_valid_file:
                flash('No file selected!', 'error')
                return redirect(request.referrer or url_for('home'))

            for file in uploaded_files:
                if file.filename == '':
                    continue
                
                # Parse directory structure from filename (e.g., "Folder/Subfolder/File.txt")
                # Web browsers send paths with forward slashes even on Windows
                path_parts = [part for part in file.filename.split('/') if part]
                
                original_filename = path_parts[-1]
                folder_path_parts = path_parts[:-1]
                
                # Ensure the folder structure exists in the DB
                target_folder_id = find_or_create_path(cursor, user_id, destination_folder_id, folder_path_parts)

                unique_display_name = get_unique_name(cursor, user_id, target_folder_id, original_filename, 'file')
                file_extension = os.path.splitext(unique_display_name)[1]
                unique_filename = str(uuid.uuid4()) + file_extension
                file_path = os.path.join(user_folder_path, unique_filename)

                # Standardized file save and size calculation
                file.seek(0, os.SEEK_END)
                file_size_bytes = file.tell()
                file.seek(0)
                file.save(file_path)

                cursor.execute(
                    "INSERT INTO files (user_id, filename, original_filename, file_size, folder_id) VALUES (%s, %s, %s, %s, %s)",
                    (user_id, unique_filename, unique_display_name, file_size_bytes, target_folder_id)
                )
                files_uploaded_count += 1
                last_uploaded_name = unique_display_name
        
        # --- Create Notifications and Finalize ---
        if files_uploaded_count > 0:
            if files_uploaded_count == 1:
                create_notification(user_id, f"You uploaded '{last_uploaded_name}'.")
            else:
                create_notification(user_id, f"You uploaded {files_uploaded_count} items.")
            flash('Files uploaded successfully!', 'success')

        conn.commit()
        conn.close()
        
        return jsonify({'success': True}) if is_ajax else redirect(request.referrer or url_for('home'))
        
    except Exception as e:
        if 'conn' in locals() and conn.is_connected(): conn.close()
        if is_ajax:
            return jsonify({'success': False, 'error': str(e)}), 500
        else:
            flash(f"An error occurred during upload: {e}", 'error')
            return redirect(request.referrer or url_for('home'))

# File action Routes and Functions (4/23)
@app.route('/create_folder', methods=['POST'])
def create_folder():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    folder_name = request.form.get('folder_name')
    
    # Get the parent folder's ID from the hidden input in the form
    parent_id_str = request.form.get('parent_id')
    parent_id = int(parent_id_str) if parent_id_str else None

    if not folder_name:
        flash('Folder name cannot be empty.', 'error')
        return redirect(request.referrer or url_for('home'))

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        unique_folder_name = get_unique_name(cursor, user_id, parent_id, folder_name, 'folder')

        # Insert the new folder into the database
        cursor.execute(
            "INSERT INTO folders (user_id, name, parent_id) VALUES (%s, %s, %s)",
            (user_id, unique_folder_name, parent_id)
        )

        conn.commit()
        conn.close()
        flash('Folder created successfully!', 'success')
        link = url_for('home', folder_id=cursor.lastrowid)
        create_notification(user_id, f"You created the folder '{unique_folder_name}'.", link)
        
    except Exception as e:
        flash(f"Error creating folder: {e}", 'error')

    # Redirect back to the page the user was on
    return redirect(request.referrer or url_for('home'))

# File action Routes and Functions (5/23)
@app.route('/move_file', methods=['POST'])
def move_file():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    file_id = request.form.get('file_id')
    destination_id_str = request.form.get('destination_folder_id')

    # If 'root' is selected, the folder_id should be NULL
    destination_id = int(destination_id_str) if destination_id_str else None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update the file's folder_id
        cursor.execute(
            "UPDATE files SET folder_id = %s WHERE id = %s AND user_id = %s",
            (destination_id, file_id, user_id)
        )
        conn.commit()
        conn.close()
        flash('File moved successfully!', 'success')
        
    except Exception as e:
        flash(f"Error moving file: {e}", 'error')

    return redirect(request.referrer or url_for('home'))

# File action Routes and Functions (6/23)
@app.route('/stash_add', methods=['POST'])
def stash_add():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    uploaded_files = request.files.getlist('file')
    
    if not uploaded_files or uploaded_files[0].filename == '':
        flash('No file selected!', 'error')
        return redirect(url_for('stash_page'))
    
    expiry_datetime_str = request.form.get('expiry_datetime')
    days = int(request.form.get('days', 0)) if request.form.get('days') else 0
    hours = int(request.form.get('hours', 0)) if request.form.get('hours') else 0
    minutes = int(request.form.get('minutes', 0)) if request.form.get('minutes') else 0
    seconds = int(request.form.get('seconds', 0)) if request.form.get('seconds') else 0

    expiry_time = None
    if expiry_datetime_str:
        expiry_time = datetime.datetime.fromisoformat(expiry_datetime_str)
    elif any([days, hours, minutes, seconds]):
        expiry_time = datetime.datetime.now() + datetime.timedelta(
            days=days, hours=hours, minutes=minutes, seconds=seconds
        )
    
    if expiry_time is None:
        flash('You must select an expiry time to stash a file.', 'error')
        return redirect(url_for('stash_page'))

    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
    if not os.path.exists(user_folder):
        os.makedirs(user_folder)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        for file in uploaded_files:
            original_filename = file.filename
            file_extension = os.path.splitext(original_filename)[1]
            unique_filename = str(uuid.uuid4()) + file_extension
            file_path = os.path.join(user_folder, unique_filename)

            file.seek(0, os.SEEK_END)
            file_size_bytes = file.tell()
            file.seek(0)

            file.save(file_path)

            cursor.execute(
                "INSERT INTO files (user_id, filename, original_filename, is_stashed, stash_expiry_at, file_size) VALUES (%s, %s, %s, %s, %s, %s)",
                (user_id, unique_filename, original_filename, 1, expiry_time, file_size_bytes)
            )
        
        conn.commit()
        conn.close()
        
        flash('Files stashed successfully!', 'success')
        if len(uploaded_files) == 1:
            create_notification(user_id, f"You stashed '{uploaded_files[0].filename}'.")
        else:
            create_notification(user_id, f"You stashed {len(uploaded_files)} files.")
    except Exception as e:
        flash(f"Error stashing files: {e}", 'error')

    return redirect(url_for('stash_page'))

# File action Routes and Functions (7/23)
@app.route('/download/<int:file_id>')
def download_file(file_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # RECURSIVE ACCESS CHECK FOR FILES
    query = """
        WITH RECURSIVE FolderPath AS (
            SELECT id, parent_id FROM folders WHERE id = (SELECT folder_id FROM files WHERE id = %s)
            UNION ALL
            SELECT f.id, f.parent_id FROM folders f INNER JOIN FolderPath fp ON f.id = fp.parent_id
        )
        SELECT f.* FROM files f
        WHERE f.id = %s AND (
            f.user_id = %s OR
            EXISTS (SELECT 1 FROM file_shares fs WHERE fs.file_id = f.id AND fs.shared_with_user_id = %s) OR
            EXISTS (SELECT 1 FROM FolderPath fp JOIN folder_shares fs ON fs.folder_id = fp.id WHERE fs.shared_with_user_id = %s)
        )
    """
    cursor.execute(query, (file_id, file_id, user_id, user_id, user_id))
    file_record = cursor.fetchone()

    if file_record:
        owner_id = file_record['user_id']
        user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(owner_id))
        file_path = os.path.join(user_folder, file_record['filename'])

        if os.path.exists(file_path):
            conn.close()
            return send_from_directory(user_folder,
                                       file_record['filename'],
                                       as_attachment=True,
                                       download_name=file_record['original_filename'])
        else:
            flash(f"Error: '{file_record['original_filename']}' could not be found on the server.", 'error')
            conn.close()
            return redirect(request.referrer or url_for('home'))
    else:
        conn.close()
        flash('File not found or access denied.', 'error')
        return redirect(url_for('home'))
    

# File action Routes and Functions (8/23)
def add_folder_to_zip_recursive(zf, cursor, user_id, user_uploads_path, folder_id, current_path):
    """
    A helper function to recursively add a folder's contents to a zip file.
    """
    # 1. Get and add files from the current folder
    cursor.execute(
        "SELECT filename, original_filename FROM files WHERE user_id = %s AND folder_id <=> %s",
        (user_id, folder_id)
    )
    files = cursor.fetchall()
    for file in files:
        physical_path = os.path.join(user_uploads_path, file['filename'])
        archive_path = os.path.join(current_path, file['original_filename'])
        if os.path.exists(physical_path):
            zf.write(physical_path, arcname=archive_path)

    # 2. Get sub-folders and recurse
    cursor.execute(
        "SELECT id, name FROM folders WHERE user_id = %s AND parent_id <=> %s",
        (user_id, folder_id)
    )
    sub_folders = cursor.fetchall()
    for sub_folder in sub_folders:
        # The new path inside the zip file for the sub-folder
        new_path = os.path.join(current_path, sub_folder['name'])
        add_folder_to_zip_recursive(zf, cursor, user_id, user_uploads_path, sub_folder['id'], new_path)

# File action Routes and Functions (9/23)
@app.route('/download_all')
def download_all():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Check if user has any files or folders to prevent creating an empty zip
    cursor.execute("SELECT id FROM files WHERE user_id = %s LIMIT 1", (user_id,))
    has_files = cursor.fetchone()
    cursor.execute("SELECT id FROM folders WHERE user_id = %s LIMIT 1", (user_id,))
    has_folders = cursor.fetchone()

    if not has_files and not has_folders:
        flash('You have no files or folders to download.', 'info')
        conn.close()
        return redirect(url_for('settings'))

    # Create a zip file in memory
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        user_uploads_path = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
        
        # Start the recursive process from the root directory (folder_id=None)
        add_folder_to_zip_recursive(zf, cursor, user_id, user_uploads_path, folder_id=None, current_path='')

    conn.close()
    memory_file.seek(0)
    
    return send_file(memory_file, download_name='myCloud_backup.zip', as_attachment=True)

# File action Routes and Functions (10/23)
@app.route('/download_folder/<int:folder_id>')
def download_folder(folder_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Recursive Access Check (same as browse_shared_folder)
    access_query = """
        WITH RECURSIVE FolderPath AS (
            SELECT id, parent_id, user_id
            FROM folders
            WHERE id = %s
            UNION ALL
            SELECT f.id, f.parent_id, f.user_id
            FROM folders f
            INNER JOIN FolderPath fp ON f.id = fp.parent_id
        )
        SELECT f1.id, f1.name, f1.user_id
        FROM folders f1
        WHERE f1.id = %s AND (
            f1.user_id = %s
            OR EXISTS (
                SELECT 1
                FROM FolderPath fp
                JOIN folder_shares fs ON fs.folder_id = fp.id
                WHERE fs.shared_with_user_id = %s
            )
        )
    """
    cursor.execute(access_query, (folder_id, folder_id, user_id, user_id))
    folder = cursor.fetchone()

    if not folder:
        flash('Folder not found or access denied.', 'error')
        conn.close()
        return redirect(request.referrer or url_for('home'))

    # Use the FOLDER OWNER'S ID and path for recursive fetching
    owner_id = folder['user_id']
    zip_filename = f"{folder['name']}.zip"
    memory_file = io.BytesIO()

    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # We must look in the OWNER'S upload directory
        owner_uploads_path = os.path.join(app.config['UPLOAD_FOLDER'], str(owner_id))
        
        # Start the recursive process for this specific folder
        # Pass owner_id so the queries find the correct files in DB
        add_folder_to_zip_recursive(zf, cursor, owner_id, owner_uploads_path, folder_id=folder_id, current_path='')

    conn.close()
    memory_file.seek(0)
    
    return send_file(memory_file, download_name=zip_filename, as_attachment=True)

# File action Routes and Functions (11/23)
@app.route('/stash_file/<int:file_id>', methods=['POST'])
def stash_file(file_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))
        
    user_id = session['id']
    
    # Logic to calculate custom expiry time from form data
    expiry_datetime_str = request.form.get('expiry_datetime')
    days = int(request.form.get('days', 0)) if request.form.get('days') else 0
    hours = int(request.form.get('hours', 0)) if request.form.get('hours') else 0
    minutes = int(request.form.get('minutes', 0)) if request.form.get('minutes') else 0
    seconds = int(request.form.get('seconds', 0)) if request.form.get('seconds') else 0

    expiry_time = None
    if expiry_datetime_str:
        expiry_time = datetime.datetime.fromisoformat(expiry_datetime_str)
    elif any([days, hours, minutes, seconds]):
        expiry_time = datetime.datetime.now() + datetime.timedelta(
            days=days, hours=hours, minutes=minutes, seconds=seconds
        )
    
    if expiry_time is None:
        flash('You must select an expiry time to stash a file.', 'error')
        return redirect(request.referrer or url_for('home'))

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Update the file to be stashed and set its custom expiry time
        cursor.execute("UPDATE files SET is_stashed = 1, stash_expiry_at = %s WHERE id = %s AND user_id = %s", 
                       (expiry_time, file_id, user_id))
        conn.commit()
        
        if cursor.rowcount > 0:
            flash('File successfully moved to Stash.', 'success')
            cursor.execute("SELECT original_filename FROM files WHERE id = %s", (file_id,))
            file_record = cursor.fetchone()
            if file_record:
                create_notification(user_id, f"You moved '{file_record[0]}' to your Stash.")
        else:
            flash('File not found or access denied.', 'error')
        conn.close()

    except Exception as e:
        flash(f"Error stashing file: {e}", 'error')

    return redirect(url_for('home'))

# File action Routes and Functions (12/23)
@app.route('/delete/<int:file_id>', methods=['POST'])
def delete_file(file_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT * FROM files WHERE id = %s AND user_id = %s", (file_id, user_id))
        file_record = cursor.fetchone()
        
        if file_record:
            user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
            file_path = os.path.join(user_folder, file_record['filename'])
            
            if os.path.exists(file_path):
                os.remove(file_path)
            
            cursor.execute("DELETE FROM files WHERE id = %s AND user_id = %s", (file_id, user_id))
            conn.commit()
            flash('File deleted successfully.', 'success')
            create_notification(user_id, f"You deleted '{file_record['original_filename']}'.")
        else:
            flash('File not found or access denied.', 'error')
        
        conn.close()

    except Exception as e:
        flash(f"Error deleting file: {e}", 'error')

    redirect_url = url_for('home')
    if request.referrer and 'stash_page' in request.referrer:
        redirect_url = url_for('stash_page')
        
    return redirect(redirect_url)

# File action Routes and Functions (13/23)
@app.route('/unstash/<int:file_id>', methods=['POST'])
def unstash_file(file_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))
        
    user_id = session['id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("UPDATE files SET is_stashed = 0, stash_expiry_at = NULL WHERE id = %s AND user_id = %s", (file_id, user_id))
        conn.commit()
        
        if cursor.rowcount > 0:
            flash('File successfully removed from stash.', 'success')
            cursor.execute("SELECT original_filename FROM files WHERE id = %s", (file_id,))
            file_record = cursor.fetchone()
            if file_record:
                create_notification(user_id, f"You unstashed '{file_record[0]}'.")
        else:
            flash('File not found or access denied.', 'error')
        conn.close()

    except Exception as e:
        flash(f"Error unstashing file: {e}", 'error')

    return redirect(url_for('stash_page'))

# File action Routes and Functions (14/23)
@app.route('/delete_all_files', methods=['POST'])
def delete_all_files():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # --- Delete all physical files ---
    cursor.execute("SELECT filename FROM files WHERE user_id = %s", (user_id,))
    files_to_delete = cursor.fetchall()

    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
    for file in files_to_delete:
        file_path = os.path.join(user_folder, file['filename'])
        if os.path.exists(file_path):
            os.remove(file_path)

    # --- Delete file records from database ---
    cursor.execute("DELETE FROM files WHERE user_id = %s", (user_id,))
    
    # --- Functionality to delete all folders ---
    cursor.execute("DELETE FROM folders WHERE user_id = %s", (user_id,))

    conn.commit()
    conn.close()

    flash('All your files and folders have been permanently deleted.', 'success')
    return redirect(url_for('settings'))

# File action Routes and Functions (15/23)
@app.route('/delete_folder/<int:folder_id>', methods=['POST'])
def delete_folder(folder_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # This helper function will recursively delete contents
        delete_folder_contents_recursive(folder_id, user_id, cursor, user_folder)

        # Finally, delete the main folder record itself
        cursor.execute("DELETE FROM folders WHERE id = %s AND user_id = %s", (folder_id, user_id))
        
        conn.commit()
        conn.close()
        flash('Folder and all its contents deleted successfully.', 'success')
        create_notification(user_id, "You deleted a folder and its contents.")

    except Exception as e:
        flash(f"Error deleting folder: {e}", 'error')

    return redirect(request.referrer or url_for('home'))

# Helper function for recursive folder deletion
def delete_folder_contents_recursive(folder_id, user_id, cursor, user_folder):
    """
    Helper function to recursively delete all files and sub-folders.
    """
    # 1. Delete all files in the current folder
    cursor.execute("SELECT filename FROM files WHERE folder_id = %s AND user_id = %s", (folder_id, user_id))
    files_to_delete = cursor.fetchall()
    for file in files_to_delete:
        file_path = os.path.join(user_folder, file['filename'])
        if os.path.exists(file_path):
            os.remove(file_path) # Delete physical file
    # Delete file records from DB for this folder
    cursor.execute("DELETE FROM files WHERE folder_id = %s AND user_id = %s", (folder_id, user_id))

    # 2. Get all sub-folders and recurse
    cursor.execute("SELECT id FROM folders WHERE parent_id = %s AND user_id = %s", (folder_id, user_id))
    sub_folders = cursor.fetchall()
    for sub_folder in sub_folders:
        delete_folder_contents_recursive(sub_folder['id'], user_id, cursor, user_folder)
        # Delete the sub-folder record itself after its contents are gone
        cursor.execute("DELETE FROM folders WHERE id = %s AND user_id = %s", (sub_folder['id'], user_id))


# File action Routes and Functions (16/23)
@app.route('/rename/<int:file_id>', methods=['POST'])
def rename_file(file_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    new_filename = request.form.get('new_filename')

    if not new_filename:
        flash('New filename cannot be empty.', 'error')
        return redirect(request.referrer or url_for('home'))

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # First, verify the file belongs to the current user
        cursor.execute("SELECT id FROM files WHERE id = %s AND user_id = %s", (file_id, user_id))
        file_record = cursor.fetchone()

        if file_record:
            folder_id = file_record['folder_id']
            unique_new_filename = get_unique_name(cursor, user_id, folder_id, new_filename, 'file')

            if unique_new_filename != new_filename:
                flash(f"A file with that name already exists. Renamed to '{unique_new_filename}'.", 'info')

            cursor.execute("UPDATE files SET original_filename = %s WHERE id = %s", (unique_new_filename, file_id))
            conn.commit()
            flash('File renamed successfully.', 'success')
            create_notification(user_id, f"You renamed a file to '{new_filename}'.")
        else:
            flash('File not found or access denied.', 'error')
        
        conn.close()

    except Exception as e:
        flash(f"Error renaming file: {e}", 'error')

    # Redirect back to the page the user was on
    return redirect(request.referrer or url_for('home'))

# File action Routes and Functions (17/23)
@app.route('/rename_folder/<int:folder_id>', methods=['POST'])
def rename_folder(folder_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    new_name = request.form.get('new_folder_name')

    if not new_name:
        flash('Folder name cannot be empty.', 'error')
        return redirect(request.referrer or url_for('home'))

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # First, get the folder's current parent_id
        cursor.execute("SELECT parent_id FROM folders WHERE id = %s AND user_id = %s", (folder_id, user_id))
        folder_record = cursor.fetchone()

        if folder_record:
            parent_id = folder_record['parent_id']
            # Get a unique name within the same parent folder
            unique_new_name = get_unique_name(cursor, user_id, parent_id, new_name, 'folder')

            if unique_new_name != new_name:
                flash(f"A folder with that name already exists. Renamed to '{unique_new_name}'.", 'info')

            cursor.execute(
                "UPDATE folders SET name = %s WHERE id = %s AND user_id = %s",
                (unique_new_name, folder_id, user_id)
            )
            conn.commit()
            conn.close()
            flash('Folder renamed successfully!', 'success')
            create_notification(user_id, f"You renamed a folder to '{unique_new_name}'.")
        
    except Exception as e:
        flash(f"Error renaming folder: {e}", 'error')

    return redirect(request.referrer or url_for('home'))

# File action Routes and Functions (18/23)
@app.route('/preview/<int:file_id>')
def preview_file(file_id):
    if 'loggedin' not in session:
        return "Access denied", 401
        
    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # RECURSIVE ACCESS CHECK FOR FILES
    query = """
        WITH RECURSIVE FolderPath AS (
            SELECT id, parent_id FROM folders WHERE id = (SELECT folder_id FROM files WHERE id = %s)
            UNION ALL
            SELECT f.id, f.parent_id FROM folders f INNER JOIN FolderPath fp ON f.id = fp.parent_id
        )
        SELECT f.* FROM files f
        WHERE f.id = %s AND (
            f.user_id = %s OR
            EXISTS (SELECT 1 FROM file_shares fs WHERE fs.file_id = f.id AND fs.shared_with_user_id = %s) OR
            EXISTS (SELECT 1 FROM FolderPath fp JOIN folder_shares fs ON fs.folder_id = fp.id WHERE fs.shared_with_user_id = %s)
        )
    """
    cursor.execute(query, (file_id, file_id, user_id, user_id, user_id))
    file_record = cursor.fetchone()
    conn.close()

    if file_record:
        owner_id = file_record['user_id']
        user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(owner_id))
        mimetype, _ = mimetypes.guess_type(file_record['filename'])
        if mimetype is None:
            mimetype = 'application/octet-stream'

        return send_from_directory(user_folder, 
                                   file_record['filename'], 
                                   mimetype=mimetype,
                                   as_attachment=False)
    else:
        return "File not found or access denied.", 404
    
# File action Routes and Functions (19/23)
@app.route('/api/raw/<int:file_id>')
def get_raw_file(file_id):
    if 'loggedin' not in session:
        return "Access denied", 401
        
    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Step 1: Get the file's details first
        cursor.execute("SELECT * FROM files WHERE id = %s", (file_id,))
        file_record = cursor.fetchone()

        if not file_record:
            conn.close()
            return "File not found", 404

        # Step 2: Check for ownership
        if file_record['user_id'] == user_id:
            has_access = True
        else:
            # Step 3: If not the owner, check for direct or inherited share access
            has_access = False
            # Check for direct file share
            cursor.execute("SELECT id FROM file_shares WHERE file_id = %s AND shared_with_user_id = %s", (file_id, user_id))
            if cursor.fetchone():
                has_access = True
            else:
                # Check for inherited folder share
                if file_record['folder_id'] is not None:
                    access_query = """
                        WITH RECURSIVE FolderPath AS (
                            SELECT id FROM folders WHERE id = %s
                            UNION ALL
                            SELECT f.parent_id FROM folders f JOIN FolderPath fp ON f.id = fp.id WHERE f.parent_id IS NOT NULL
                        )
                        SELECT 1 FROM FolderPath fp JOIN folder_shares fs ON fp.id = fs.folder_id WHERE fs.shared_with_user_id = %s
                    """
                    cursor.execute(access_query, (file_record['folder_id'], user_id))
                    if cursor.fetchone():
                        has_access = True
        
        if has_access:
            owner_id = file_record['user_id']
            user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(owner_id))
            conn.close()
            return send_from_directory(user_folder, file_record['filename'])
        else:
            conn.close()
            return "Access denied", 403

    except Exception as e:
        if 'conn' in locals() and conn.is_connected():
            conn.close()
        return f"An internal error occurred: {e}", 500
    
# File action Routes and Functions (20/23)
@app.route('/add_shared_to_mycloud/<int:file_id>', methods=['POST'])
def add_shared_to_mycloud(file_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # First, get the details of the original shared file
        cursor.execute("SELECT * FROM files WHERE id = %s", (file_id,))
        original_file = cursor.fetchone()

        if not original_file:
            flash("Original file not found.", "error")
            conn.close()
            return redirect(url_for('shared_files'))

        # Get the owner's ID and build the path to the source file
        owner_id = original_file['user_id']
        source_user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(owner_id))
        source_file_path = os.path.join(source_user_folder, original_file['filename'])

        # Check if the source file actually exists
        if not os.path.exists(source_file_path):
            flash("The original file seems to be missing from the owner's cloud.", "error")
            conn.close()
            return redirect(url_for('shared_files'))

        # Prepare the destination for the new copy
        destination_user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
        if not os.path.exists(destination_user_folder):
            os.makedirs(destination_user_folder)
        
        # Create a new unique filename for the copy
        file_extension = os.path.splitext(original_file['filename'])[1]
        new_unique_filename = str(uuid.uuid4()) + file_extension
        destination_file_path = os.path.join(destination_user_folder, new_unique_filename)

        # Physically copy the file
        shutil.copy2(source_file_path, destination_file_path)
        
        # Create a new file record for the current user, pointing to their new copy
        cursor.execute(
            """INSERT INTO files (user_id, filename, original_filename, file_size, is_stashed) 
               VALUES (%s, %s, %s, %s, 0)""",
            (user_id, new_unique_filename, original_file['original_filename'], original_file['file_size'])
        )
        conn.commit()
        flash(f"'{original_file['original_filename']}' has been copied to your My Cloud.", "success")
        create_notification(user_id, f"You copied '{original_file['original_filename']}' to your My Cloud.")

    except Exception as e:
        flash(f"An error occurred: {e}", "error")
    
    conn.close()
    return redirect(url_for('shared_files'))

# File action Routes and Functions (21/23)
@app.route('/remove_share/<int:file_id>', methods=['POST'])
def remove_share(file_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))
        
    user_id = session['id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Delete the share record only for the current user
        cursor.execute("DELETE FROM file_shares WHERE file_id = %s AND shared_with_user_id = %s", 
                       (file_id, user_id))
        conn.commit()
        
        if cursor.rowcount > 0:
            flash('The file has been removed from your shared list.', 'success')
        else:
            flash('Share record not found or access denied.', 'error')
        conn.close()

    except Exception as e:
        flash(f"Error removing share: {e}", 'error')

    return redirect(url_for('shared_files'))

# File action Routes and Functions (22/23)
@app.route('/copy_shared_folder/<int:folder_id>', methods=['POST'])
def copy_shared_folder(folder_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # First, verify the user has access to this shared folder
    cursor.execute("SELECT * FROM folder_shares WHERE folder_id = %s AND shared_with_user_id = %s", (folder_id, user_id))
    share_record = cursor.fetchone()

    if not share_record:
        flash("Access denied or share not found.", "error")
        conn.close()
        return redirect(url_for('shared_files'))

    try:
        # Start the recursive copy process
        copy_folder_recursive(cursor, folder_id, user_id, None) # None for parent_id means copy to root
        conn.commit()
        flash("Folder and its contents have been copied to your My Cloud.", "success")
    except Exception as e:
        conn.rollback()
        flash(f"An error occurred while copying the folder: {e}", "error")
    
    conn.close()
    return redirect(url_for('shared_files'))

# Helper function for recursive folder copy
def copy_folder_recursive(cursor, original_folder_id, new_owner_id, new_parent_id):
    """
    Helper function to recursively copy a folder, its sub-folders, and its files.
    """
    # 1. Get original folder's details
    cursor.execute("SELECT * FROM folders WHERE id = %s", (original_folder_id,))
    original_folder = cursor.fetchone()
    
    if not original_folder:
        return # Stop if original folder doesn't exist

    # 2. Create the new folder for the current user
    cursor.execute(
        "INSERT INTO folders (user_id, name, parent_id) VALUES (%s, %s, %s)",
        (new_owner_id, original_folder['name'], new_parent_id)
    )
    new_folder_id = cursor.lastrowid

    # 3. Copy files from the original folder to the new folder
    cursor.execute("SELECT * FROM files WHERE folder_id = %s", (original_folder_id,))
    files_to_copy = cursor.fetchall()

    for file in files_to_copy:
        # We need to physically copy the file on the server
        owner_id = file['user_id']
        source_user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(owner_id))
        source_file_path = os.path.join(source_user_folder, file['filename'])
        
        destination_user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(new_owner_id))
        if not os.path.exists(destination_user_folder):
            os.makedirs(destination_user_folder)
        
        file_extension = os.path.splitext(file['filename'])[1]
        new_unique_filename = str(uuid.uuid4()) + file_extension
        destination_file_path = os.path.join(destination_user_folder, new_unique_filename)

        if os.path.exists(source_file_path):
            shutil.copy2(source_file_path, destination_file_path)

            # Create new file record for the new owner
            cursor.execute(
                """INSERT INTO files (user_id, filename, original_filename, file_size, folder_id) 
                   VALUES (%s, %s, %s, %s, %s)""",
                (new_owner_id, new_unique_filename, file['original_filename'], file['file_size'], new_folder_id)
            )

    # 4. Get original sub-folders and recurse
    cursor.execute("SELECT id FROM folders WHERE parent_id = %s", (original_folder_id,))
    sub_folders = cursor.fetchall()
    for sub_folder in sub_folders:
        copy_folder_recursive(cursor, sub_folder['id'], new_owner_id, new_folder_id)

# File action Routes and Functions (23/23)
@app.route('/remove_folder_share/<int:folder_id>', methods=['POST'])
def remove_folder_share(folder_id):
    if 'loggedin' not in session:
        return redirect(url_for('login'))
        
    user_id = session['id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Delete the share record for the current user
        cursor.execute("DELETE FROM folder_shares WHERE folder_id = %s AND shared_with_user_id = %s", 
                       (folder_id, user_id))
        conn.commit()
        
        if cursor.rowcount > 0:
            flash('The shared folder has been removed from your list.', 'success')
        else:
            flash('Share record not found or access denied.', 'error')
        conn.close()

    except Exception as e:
        flash(f"Error removing share: {e}", 'error')

    return redirect(url_for('shared_files'))
    

# API Routes and Functions (1/22)
@app.route('/file_details/<int:file_id>')
def file_details(file_id):
    if 'loggedin' not in session:
        return jsonify({'error': 'User not logged in'}), 401
    
    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Recursive Access Check for Files
    query = """
        WITH RECURSIVE FileFolderPath AS (
            SELECT id, parent_id, user_id
            FROM folders
            WHERE id = (SELECT f.folder_id FROM files f WHERE f.id = %s)
            
            UNION ALL

            SELECT f.id, f.parent_id, f.user_id
            FROM folders f
            JOIN FileFolderPath ffp ON f.id = ffp.parent_id
        )
        SELECT 
            f.*, 
            u.name as owner_name,
            u.email as owner_email,
            COALESCE(
                (SELECT fs.shared_at FROM file_shares fs WHERE fs.file_id = f.id AND fs.shared_with_user_id = %s),
                (SELECT fsh.shared_at FROM FileFolderPath fp JOIN folder_shares fsh ON fsh.folder_id = fp.id WHERE fsh.shared_with_user_id = %s ORDER BY LENGTH(fp.id) DESC LIMIT 1)
            ) as effective_shared_at,
            COALESCE(
                (SELECT us.name FROM file_shares fs JOIN users us ON fs.user_id = us.id WHERE fs.file_id = f.id AND fs.shared_with_user_id = %s),
                (SELECT us.name FROM FileFolderPath fp JOIN folder_shares fsh ON fsh.folder_id = fp.id JOIN users us ON fsh.user_id = us.id WHERE fsh.shared_with_user_id = %s ORDER BY LENGTH(fp.id) DESC LIMIT 1),
                u.name
            ) as sharer_name
        FROM files f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = %s AND (
            f.user_id = %s OR
            EXISTS (SELECT 1 FROM file_shares fs WHERE fs.file_id = f.id AND fs.shared_with_user_id = %s) OR
            (f.folder_id IS NOT NULL AND EXISTS (SELECT 1 FROM FileFolderPath fp JOIN folder_shares fsh ON fsh.folder_id = fp.id WHERE fsh.shared_with_user_id = %s))
        )
    """
    cursor.execute(query, (file_id, user_id, user_id, user_id, user_id, file_id, user_id, user_id, user_id))
    file_record = cursor.fetchone()

    if not file_record:
        conn.close()
        # Fallback for root-level shared files
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT f.*, u.name as owner_name, u.email as owner_email, fs.shared_at as effective_shared_at, us.name as sharer_name
            FROM files f
            JOIN file_shares fs ON f.id = fs.file_id
            JOIN users u ON f.user_id = u.id
            JOIN users us ON fs.user_id = us.id
            WHERE f.id = %s AND fs.shared_with_user_id = %s AND f.folder_id IS NULL
        """, (file_id, user_id))
        file_record = cursor.fetchone()

    if not file_record:
        conn.close()
        return jsonify({'error': 'File not found or access denied'}), 404

    try:
        details = {
            'id': file_record['id'],
            'original_filename': file_record['original_filename'],
            'upload_date': file_record['upload_date'].strftime('%Y-%m-%d %H:%M:%S'),
            'file_type': os.path.splitext(file_record['original_filename'])[1] or 'Unknown',
            'size_formatted': format_file_size(file_record['file_size']),
            'path': get_item_path(cursor, file_id, 'file') # <-- Add this line
        }

        if file_record['user_id'] != user_id and file_record.get('effective_shared_at'):
            details['shared_at'] = file_record['effective_shared_at'].strftime('%Y-%m-%d %H:%M:%S')
            details['shared_by'] = {'name': file_record['sharer_name'], 'email': file_record['owner_email']}
        
        conn.close()
        return jsonify(details)

    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

# API Routes and Functions (2/22)
@app.route('/api/folder_details/<int:folder_id>')
def folder_details(folder_id):
    if 'loggedin' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    user_id = session['id']
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Step 1: Get basic folder and owner info
        cursor.execute("""
            SELECT f.id, f.name, f.created_at, f.user_id as owner_id, u.name as owner_name, u.email as owner_email
            FROM folders f
            JOIN users u ON f.user_id = u.id
            WHERE f.id = %s
        """, (folder_id,))
        folder = cursor.fetchone()

        if not folder:
            conn.close()
            return jsonify({'error': 'Folder not found'}), 404

        # Step 2: Verify access
        owner_id = folder['owner_id']
        if owner_id != user_id:
            cursor.execute("""
                WITH RECURSIVE FolderPath AS (
                    SELECT id FROM folders WHERE id = %s
                    UNION ALL
                    SELECT f.parent_id FROM folders f JOIN FolderPath fp ON f.id = fp.id WHERE f.parent_id IS NOT NULL
                )
                SELECT 1 FROM FolderPath fp JOIN folder_shares fs ON fp.id = fs.folder_id WHERE fs.shared_with_user_id = %s
            """, (folder_id, user_id))
            if not cursor.fetchone():
                conn.close()
                return jsonify({'error': 'Access Denied'}), 403

        # Step 3: Gather all necessary data BEFORE building the dictionary
        cursor.execute("SELECT COUNT(id) as count FROM folders WHERE parent_id = %s", (folder_id,))
        folder_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(id) as count FROM files WHERE folder_id = %s", (folder_id,))
        file_count = cursor.fetchone()['count']
        
        total_size_recursive = get_folder_stats_recursive(cursor, folder_id)
        path = get_item_path(cursor, folder_id, 'folder') # Get the path

        # Step 4: Now, build the details dictionary
        details = {
            'name': folder['name'],
            'created_at': folder['created_at'].strftime('%Y-%m-%d %H:%M:%S'),
            'folder_count': folder_count,
            'file_count': file_count,
            'size_formatted': format_file_size(total_size_recursive),
            'path': path  # Add the path here
        }

        if owner_id != user_id:
            cursor.execute("SELECT shared_at FROM folder_shares WHERE folder_id = %s AND shared_with_user_id = %s", (folder_id, user_id))
            share_info = cursor.fetchone()
            details['shared_at'] = share_info['shared_at'].strftime('%Y-%m-%d %H:%M:%S') if share_info else 'Inherited'
            details['shared_by'] = {'name': folder['owner_name'], 'email': folder['owner_email']}
        
        conn.close()
        return jsonify(details)

    except Exception as e:
        if 'conn' in locals() and conn.is_connected():
            conn.close()
        return jsonify({'error': str(e)}), 500

# API Routes and Functions (3/22)
@app.route('/api/move_file', methods=['POST'])
def api_move_file():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    data = request.get_json()
    user_id = session['id']
    file_id = data.get('file_id')
    destination_id = data.get('destination_folder_id')

    if not file_id:
        return jsonify({'success': False, 'error': 'File ID is missing'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE files SET folder_id = %s WHERE id = %s AND user_id = %s",
            (destination_id, file_id, user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
# API Routes and Functions (4/22)
@app.route('/move_batch', methods=['POST'])
def move_batch():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    destination_folder_id = request.form.get('destination_folder_id')
    
    # Get lists of selected item IDs from the form
    selected_files = request.form.getlist('selected_files')
    selected_folders = request.form.getlist('selected_folders')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update folder_id for each selected file
        if selected_files:
            # The query needs to be formatted carefully for a list of IDs
            file_query = "UPDATE files SET folder_id = %s WHERE user_id = %s AND id IN ({})".format(','.join(['%s'] * len(selected_files)))
            params = [destination_folder_id, user_id] + selected_files
            cursor.execute(file_query, params)
        
        # Update parent_id for each selected folder
        if selected_folders:
            folder_query = "UPDATE folders SET parent_id = %s WHERE user_id = %s AND id IN ({})".format(','.join(['%s'] * len(selected_folders)))
            params = [destination_folder_id, user_id] + selected_folders
            cursor.execute(folder_query, params)

        conn.commit()
        conn.close()
        flash('Items moved successfully!', 'success')
        
    except Exception as e:
        flash(f"Error moving items: {e}", 'error')

    return redirect(request.referrer or url_for('home'))

# API Routes and Functions (5/22)
@app.route('/live_search')
def live_search():
    if 'loggedin' not in session:
        return jsonify(error="Not logged in"), 401

    user_id = session['id']
    query = request.args.get('q', '')

    if len(query) < 2:
        return jsonify([])

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    search_term = f"%{query}%"
    
    # RECURSIVE Search query
    universal_query = """
        WITH RECURSIVE AccessibleFolders AS (
            -- Folders user owns
            SELECT id, user_id FROM folders WHERE user_id = %(user_id)s
            UNION
            -- Folders directly shared with user
            SELECT f.id, f.user_id FROM folders f JOIN folder_shares fs ON f.id = fs.folder_id WHERE fs.shared_with_user_id = %(user_id)s
            UNION
            -- Sub-folders of the above
            SELECT f.id, f.user_id FROM folders f JOIN AccessibleFolders af ON f.parent_id = af.id
        )
        SELECT id, name, item_type, user_id FROM (
            -- Files user owns
            (SELECT f.id, f.original_filename as name, 'file' as item_type, f.user_id
             FROM files f
             WHERE f.user_id = %(user_id)s AND f.original_filename LIKE %(search)s)
            UNION
            -- Files directly shared with user
            (SELECT f.id, f.original_filename as name, 'file' as item_type, f.user_id
             FROM files f
             JOIN file_shares fs ON f.id = fs.file_id
             WHERE fs.shared_with_user_id = %(user_id)s AND f.original_filename LIKE %(search)s)
            UNION
            -- Files within accessible folders
            (SELECT f.id, f.original_filename as name, 'file' as item_type, f.user_id
             FROM files f
             WHERE f.folder_id IN (SELECT id FROM AccessibleFolders) AND f.original_filename LIKE %(search)s)
            UNION
            -- Folders from the accessible list that match the search
            (SELECT af.id, fo.name, 'folder' as item_type, af.user_id
             FROM AccessibleFolders af
             JOIN folders fo ON af.id = fo.id
             WHERE fo.name LIKE %(search)s)
        ) as combined_results
        GROUP BY id, name, item_type, user_id
        ORDER BY name 
        LIMIT 10
    """
    
    params = {'user_id': user_id, 'search': search_term}
    cursor.execute(universal_query, params)
    results = cursor.fetchall()
    conn.close()

    return jsonify(results)

# API Routes and Functions (6/22)
@app.route('/check_email', methods=['POST'])
def check_email():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'available': False})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    conn.close()

    return jsonify({'available': user is None})

# API Routes and Functions (7/22)
@app.route('/check_username', methods=['POST'])
def check_username():
    data = request.get_json()
    username = data.get('username')
    
    if not username:
        return jsonify({'available': False})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    conn.close()

    return jsonify({'available': user is None})

# API Routes and Functions (8/22)
@app.route('/suggest_username', methods=['POST'])
def suggest_username():
    data = request.get_json()
    base_username = data.get('username')
    
    if not base_username:
        return jsonify({'suggestions': []})

    suggestions = []
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Generate a few suggestions (e.g., with numbers)
    for _ in range(3):
        suggestion = f"{base_username}{random.randint(10, 99)}"
        suggestions.append(suggestion)

    # Add a suggestion with a common word
    common_words = ['_dev', '_pro', 'One']
    suggestions.append(f"{base_username}{random.choice(common_words)}")

    # Check which of our generated suggestions are actually available
    available_suggestions = []
    for s in suggestions:
        cursor.execute("SELECT id FROM users WHERE username = %s", (s,))
        if cursor.fetchone() is None:
            available_suggestions.append(s)
            # We only need a few, so we can stop early
            if len(available_suggestions) >= 3:
                break
    
    conn.close()
    return jsonify({'suggestions': available_suggestions})

# API Routes and Functions (9/22)
@app.route('/generate_share_link/<int:file_id>', methods=['POST'])
def generate_share_link(file_id):
    if 'loggedin' not in session:
        return jsonify(error="Not logged in"), 401

    # Check if the user owns the file they are trying to share
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM files WHERE id = %s AND user_id = %s", (file_id, session['id']))
    if not cursor.fetchone():
        conn.close()
        return jsonify(error="Access denied"), 403
    
    # Generate a secure, unique token
    token = secrets.token_urlsafe(32)
    
    # Store the token and file association in the new table
    cursor.execute("INSERT INTO share_links (file_id, token) VALUES (%s, %s)", (file_id, token))
    conn.commit()
    conn.close()
    
    # Build the full shareable URL
    share_url = url_for('shared_files', token=token, _external=True)
    return jsonify(share_url=share_url)

# API Routes and Functions (10/22)
@app.route('/generate_folder_share_link/<int:folder_id>', methods=['POST'])
def generate_folder_share_link(folder_id):
    if 'loggedin' not in session:
        return jsonify(error="Not logged in"), 401

    # Check if the user owns the folder
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM folders WHERE id = %s AND user_id = %s", (folder_id, session['id']))
    if not cursor.fetchone():
        conn.close()
        return jsonify(error="Access denied"), 403
    
    token = secrets.token_urlsafe(32)
    
    # Store the token and folder association
    cursor.execute("INSERT INTO folder_share_links (folder_id, token) VALUES (%s, %s)", (folder_id, token))
    conn.commit()
    conn.close()
    
    # This part needs to be updated to point to a new view for shared folders
    share_url = url_for('shared_files', token=token, _external=True)
    return jsonify(share_url=share_url)

# API Routes and Functions (11/22)
@app.route('/get_link_details', methods=['POST'])
def get_link_details():
    if 'loggedin' not in session:
        return jsonify(error="Not logged in"), 401
    
    data = request.get_json()
    token = data.get('token')

    if not token:
        return jsonify(error="Token is missing"), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # First, try to find the token in the file share links table
    query = """
        SELECT f.id, f.original_filename, f.file_size, u.name as owner_name
        FROM share_links sl
        JOIN files f ON sl.file_id = f.id
        JOIN users u ON f.user_id = u.id
        WHERE sl.token = %s
    """
    cursor.execute(query, (token,))
    item_details = cursor.fetchone()

    if item_details:
        # It's a file! Add item_type and format the size.
        item_details['item_type'] = 'file'
        item_details['file_size_formatted'] = format_file_size(item_details['file_size'])
    else:
        # If not found, try to find the token in the folder share links table
        query = """
            SELECT fo.id, fo.name as original_filename, u.name as owner_name
            FROM folder_share_links fsl
            JOIN folders fo ON fsl.folder_id = fo.id
            JOIN users u ON fo.user_id = u.id
            WHERE fsl.token = %s
        """
        cursor.execute(query, (token,))
        item_details = cursor.fetchone()
        if item_details:
            # It's a folder! Add item_type.
            item_details['item_type'] = 'folder'
            item_details['file_size_formatted'] = "N/A" # Folders don't have a single size here

    conn.close()

    if not item_details:
        return jsonify(error="Invalid or expired link"), 404
    
    return jsonify(item_details)

# API Routes and Functions (12/22)
@app.route('/add_share_from_token', methods=['POST'])
def add_share_from_token():
    if 'loggedin' not in session:
        return redirect(url_for('login'))
        
    user_id = session['id']
    token = request.form.get('token')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Get the file_id AND the original owner's ID from the token
    cursor.execute("""
        SELECT sl.file_id, f.user_id as owner_id
        FROM share_links sl JOIN files f ON sl.file_id = f.id
        WHERE sl.token = %s
    """, (token,))
    link_data = cursor.fetchone()

    if not link_data:
        flash("Invalid or expired share link.", "error")
        conn.close()
        return redirect(url_for('shared_files'))

    file_id = link_data['file_id']
    owner_id = link_data['owner_id']
    
    try:
        # Add the owner_id to the INSERT statement
        cursor.execute(
            "INSERT INTO file_shares (user_id, file_id, shared_with_user_id) VALUES (%s, %s, %s)",
            (owner_id, file_id, user_id)
        )
        conn.commit()
        flash("File successfully added to your Shared Files!", "success")
    except mysql.connector.IntegrityError:
        flash("This file is already in your shared list.", "info")
    except Exception as e:
        flash(f"An error occurred: {e}", "error")
    
    conn.close()
    return redirect(url_for('shared_files'))

# API Routes and Functions (13/22)
@app.route('/api/move_folder', methods=['POST'])
def api_move_folder():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    data = request.get_json()
    user_id = session['id']
    folder_id = data.get('folder_id')
    destination_folder_id = data.get('destination_folder_id')

    # A folder cannot be moved into itself.
    if folder_id == destination_folder_id:
        return jsonify({'success': False, 'error': 'Cannot move a folder into itself.'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Prevent moving a folder into one of its own descendants.
        if is_descendant(cursor, folder_id, destination_folder_id):
            conn.close()
            return jsonify({'success': False, 'error': 'Cannot move a folder into its own subfolder.'}), 400

        # Update the folder's parent_id
        cursor.execute(
            "UPDATE folders SET parent_id = %s WHERE id = %s AND user_id = %s",
            (destination_folder_id, folder_id, user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
# API Routes and Functions (14/8)
@app.route('/api/notifications')
def get_notifications():
    if 'loggedin' not in session:
        return jsonify(error="Not logged in"), 401
    
    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Fetch recent unread notifications, with a limit
    cursor.execute(
        "SELECT id, message, link_url, created_at FROM notifications WHERE user_id = %s AND is_read = FALSE ORDER BY created_at DESC LIMIT 20",
        (user_id,)
    )
    notifications = cursor.fetchall()
    conn.close()
    
    # Format the 'created_at' field for display
    for notification in notifications:
        notification['created_at'] = calculate_account_age(notification['created_at']) # Reuse our handy time-ago function

    return jsonify(notifications)

# API Routes and Functions (15/22)
@app.route('/api/notifications/mark_read', methods=['POST'])
def mark_notifications_read():
    if 'loggedin' not in session:
        return jsonify(error="Not logged in"), 401
    
    user_id = session['id']
    data = request.get_json()
    notification_ids = data.get('ids', [])

    if not notification_ids:
        return jsonify(success=True)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create a placeholder string for the query, e.g., (%s, %s, %s)
        placeholders = ','.join(['%s'] * len(notification_ids))
        query = f"UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND id IN ({placeholders})"
        
        params = [user_id] + notification_ids
        cursor.execute(query, params)
        conn.commit()
        conn.close()
        return jsonify(success=True)
    except Exception as e:
        print(f"Error marking notifications as read: {e}")
        return jsonify(success=False, error=str(e)), 500

# API Routes and Functions (16/22)  
@app.route('/api/batch_move', methods=['POST'])
def batch_move():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    user_id = session['id']
    data = request.get_json()
    file_ids = data.get('file_ids', [])
    folder_ids = data.get('folder_ids', [])
    destination_id_str = data.get('destination_folder_id')
    destination_id = int(destination_id_str) if destination_id_str else None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Prevent moving a folder into itself or a descendant
        for folder_id in folder_ids:
            if folder_id == destination_id or is_descendant(cursor, folder_id, destination_id):
                conn.close()
                return jsonify({'success': False, 'error': 'Invalid move operation: cannot move a folder into itself or a subfolder.'}), 400

        # Move folders
        if folder_ids:
            placeholders = ','.join(['%s'] * len(folder_ids))
            query = f"UPDATE folders SET parent_id = %s WHERE user_id = %s AND id IN ({placeholders})"
            cursor.execute(query, [destination_id, user_id] + folder_ids)

        # Move files
        if file_ids:
            placeholders = ','.join(['%s'] * len(file_ids))
            query = f"UPDATE files SET folder_id = %s WHERE user_id = %s AND id IN ({placeholders})"
            cursor.execute(query, [destination_id, user_id] + file_ids)

        conn.commit()
        conn.close()
        create_notification(user_id, f"You moved {len(file_ids) + len(folder_ids)} items.")
        return jsonify({'success': True})

    except Exception as e:
        if 'conn' in locals() and conn.is_connected(): conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500
    
# API Routes and Functions (17/22)
@app.route('/api/batch_delete', methods=['POST'])
def batch_delete():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    user_id = session['id']
    data = request.get_json()
    file_ids = data.get('file_ids', [])
    folder_ids = data.get('folder_ids', [])
    
    if not file_ids and not folder_ids:
        return jsonify({'success': False, 'error': 'No items selected'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        user_folder_path = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))

        # Delete folders and their contents recursively
        for folder_id in folder_ids:
            # We can reuse our existing recursive delete helper
            delete_folder_contents_recursive(folder_id, user_id, cursor, user_folder_path)
            cursor.execute("DELETE FROM folders WHERE id = %s AND user_id = %s", (folder_id, user_id))

        # Delete individual files
        if file_ids:
            # Create placeholders for the query, e.g., (%s, %s, %s)
            placeholders = ','.join(['%s'] * len(file_ids))
            
            # First, get filenames to delete them from storage
            query = f"SELECT filename FROM files WHERE user_id = %s AND id IN ({placeholders})"
            cursor.execute(query, [user_id] + file_ids)
            files_to_delete = cursor.fetchall()
            for file in files_to_delete:
                file_path = os.path.join(user_folder_path, file['filename'])
                if os.path.exists(file_path):
                    os.remove(file_path)
            
            # Then, delete the file records from the database
            query = f"DELETE FROM files WHERE user_id = %s AND id IN ({placeholders})"
            cursor.execute(query, [user_id] + file_ids)

        conn.commit()
        conn.close()
        # Create a single notification for the batch action
        create_notification(user_id, f"You deleted {len(file_ids) + len(folder_ids)} items.")
        return jsonify({'success': True})

    except Exception as e:
        if 'conn' in locals() and conn.is_connected(): conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500
    
# API Routes and Functions (18/22)
@app.route('/api/batch_unstash', methods=['POST'])
def batch_unstash():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    user_id = session['id']
    data = request.get_json()
    file_ids = data.get('file_ids', [])

    if not file_ids:
        return jsonify({'success': False, 'error': 'No items selected'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Update files to unstash them
        placeholders = ','.join(['%s'] * len(file_ids))
        query = f"UPDATE files SET is_stashed = 0, stash_expiry_at = NULL WHERE user_id = %s AND id IN ({placeholders})"
        cursor.execute(query, [user_id] + file_ids)

        conn.commit()
        conn.close()
        create_notification(user_id, f"You unstashed {len(file_ids)} items.")
        return jsonify({'success': True})

    except Exception as e:
        if 'conn' in locals() and conn.is_connected(): conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500
    
# API Routes and Functions (18/22)
@app.route('/api/batch_remove_share', methods=['POST'])
def batch_remove_share():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    user_id = session['id']
    data = request.get_json()
    file_ids = data.get('file_ids', [])
    folder_ids = data.get('folder_ids', [])

    if not file_ids and not folder_ids:
        return jsonify({'success': False, 'error': 'No items selected'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Remove file shares
        if file_ids:
            placeholders = ','.join(['%s'] * len(file_ids))
            query = f"DELETE FROM file_shares WHERE shared_with_user_id = %s AND file_id IN ({placeholders})"
            cursor.execute(query, [user_id] + file_ids)

        # Remove folder shares
        if folder_ids:
            placeholders = ','.join(['%s'] * len(folder_ids))
            query = f"DELETE FROM folder_shares WHERE shared_with_user_id = %s AND folder_id IN ({placeholders})"
            cursor.execute(query, [user_id] + folder_ids)

        conn.commit()
        conn.close()
        create_notification(user_id, f"You removed {len(file_ids) + len(folder_ids)} shared items.")
        return jsonify({'success': True})

    except Exception as e:
        if 'conn' in locals() and conn.is_connected(): conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

# API Routes and Functions (19/22)
@app.route('/api/batch_add_to_mycloud', methods=['POST'])
def batch_add_to_mycloud():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    user_id = session['id']
    data = request.get_json()
    file_ids = data.get('file_ids', [])
    folder_ids = data.get('folder_ids', [])

    if not file_ids and not folder_ids:
        return jsonify({'success': False, 'error': 'No items selected'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Copy individual files
        for file_id in file_ids:
            add_shared_to_mycloud(file_id) # Reuse the single file copy logic

        # Copy folders recursively
        for folder_id in folder_ids:
            copy_folder_recursive(cursor, folder_id, user_id, None)

        conn.commit()
        conn.close()
        create_notification(user_id, f"You copied {len(file_ids) + len(folder_ids)} items to your My Cloud.")
        return jsonify({'success': True})

    except Exception as e:
        if 'conn' in locals() and conn.is_connected(): conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500
    
# API Routes and Functions (20/22)
@app.route('/api/batch_stash', methods=['POST'])
def batch_stash():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    user_id = session['id']
    data = request.get_json()
    file_ids = data.get('file_ids', [])
    
    # Expiry time logic is similar to single stash
    expiry_datetime_str = data.get('expiry_datetime')
    days = int(data.get('days', 0))
    hours = int(data.get('hours', 0))
    minutes = int(data.get('minutes', 0))
    seconds = int(data.get('seconds', 0))

    expiry_time = None
    if expiry_datetime_str:
        expiry_time = datetime.datetime.fromisoformat(expiry_datetime_str)
    elif any([days, hours, minutes, seconds]):
        expiry_time = datetime.datetime.now() + datetime.timedelta(
            days=days, hours=hours, minutes=minutes, seconds=seconds
        )
    
    if not file_ids:
        return jsonify({'success': False, 'error': 'No files selected'}), 400
    if expiry_time is None:
        return jsonify({'success': False, 'error': 'You must select an expiry time.'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        placeholders = ','.join(['%s'] * len(file_ids))
        query = f"UPDATE files SET is_stashed = 1, stash_expiry_at = %s WHERE user_id = %s AND id IN ({placeholders})"
        
        params = [expiry_time, user_id] + file_ids
        cursor.execute(query, params)
        
        conn.commit()
        conn.close()
        create_notification(user_id, f"You stashed {len(file_ids)} items.")
        return jsonify({'success': True})

    except Exception as e:
        if 'conn' in locals() and conn.is_connected(): conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

# API Routes and Functions (21/22)
@app.route('/api/batch_download', methods=['POST'])
def batch_download():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    user_id = session['id']
    data = request.get_json()
    file_ids = data.get('file_ids', [])
    folder_ids = data.get('folder_ids', [])

    if not file_ids and not folder_ids:
        return "No items selected", 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    user_uploads_path = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add individually selected files from the root of the selection
        if file_ids:
            placeholders = ','.join(['%s'] * len(file_ids))
            query = f"SELECT filename, original_filename FROM files WHERE user_id = %s AND id IN ({placeholders})"
            cursor.execute(query, [user_id] + file_ids)
            files_to_zip = cursor.fetchall()
            for file in files_to_zip:
                file_path = os.path.join(user_uploads_path, file['filename'])
                if os.path.exists(file_path):
                    zf.write(file_path, arcname=file['original_filename'])

        # Add folders and their contents recursively
        for folder_id in folder_ids:
            cursor.execute("SELECT name FROM folders WHERE id = %s AND user_id = %s", (folder_id, user_id))
            folder_info = cursor.fetchone()
            if folder_info:
                # We reuse our powerful recursive helper function here
                add_folder_to_zip_recursive(zf, cursor, user_id, user_uploads_path, folder_id, folder_info['name'])

    conn.close()
    memory_file.seek(0)
    
    return send_file(memory_file, download_name='myCloud_selection.zip', as_attachment=True)

# API Routes and Functions (22/22)
@app.route('/api/batch_share', methods=['POST'])
def batch_share():
    if 'loggedin' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401

    user_id = session['id']
    data = request.get_json()
    file_ids = data.get('file_ids', [])
    folder_ids = data.get('folder_ids', [])
    email = data.get('email')

    if not email:
        return jsonify({'success': False, 'error': 'Email address is required.'}), 400
    if not file_ids and not folder_ids:
        return jsonify({'success': False, 'error': 'No items selected.'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Find the user to share with
        cursor.execute("SELECT id, name FROM users WHERE email = %s", (email,))
        user_to_share_with = cursor.fetchone()

        if not user_to_share_with:
            return jsonify({'success': False, 'error': f'No user found with the email address "{email}".'}), 404
        
        shared_with_user_id = user_to_share_with['id']
        if shared_with_user_id == user_id:
            return jsonify({'success': False, 'error': 'You cannot share items with yourself.'}), 400

        # Share files
        for file_id in file_ids:
            try:
                cursor.execute("INSERT INTO file_shares (user_id, file_id, shared_with_user_id) VALUES (%s, %s, %s)",
                               (user_id, file_id, shared_with_user_id))
            except mysql.connector.IntegrityError:
                pass # Item already shared, ignore

        # Share folders
        for folder_id in folder_ids:
            try:
                cursor.execute("INSERT INTO folder_shares (user_id, folder_id, shared_with_user_id) VALUES (%s, %s, %s)",
                               (user_id, folder_id, shared_with_user_id))
            except mysql.connector.IntegrityError:
                pass # Item already shared, ignore
        
        conn.commit()

        # Create notifications for the recipient
        owner_name = session.get('name', 'A user')
        item_count = len(file_ids) + len(folder_ids)
        create_notification(shared_with_user_id, f"'{owner_name}' shared {item_count} items with you.", url_for('shared_files'))
        
        conn.close()
        return jsonify({'success': True, 'message': f'Items successfully shared with {user_to_share_with["name"]}.'})

    except Exception as e:
        if 'conn' in locals() and conn.is_connected(): conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500


# User Settings Routes and Functions (1/7)
@app.route('/settings')
def settings():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT name, username, email, created_at, profile_pic, oauth_provider FROM users WHERE id = %s", (user_id,))
    user_details = cursor.fetchone()

    # Calculate storage breakdown
    cursor.execute("SELECT SUM(file_size) as total FROM files WHERE user_id = %s AND is_stashed = 0", (user_id,))
    main_storage_bytes = int(cursor.fetchone()['total'] or 0)
    main_storage_str = format_file_size(main_storage_bytes)

    cursor.execute("SELECT SUM(file_size) as total FROM files WHERE user_id = %s AND is_stashed = 1", (user_id,))
    stash_storage_bytes = int(cursor.fetchone()['total'] or 0)
    stash_storage_str = format_file_size(stash_storage_bytes)

    conn.close()

    # Calculate account age
    account_age = calculate_account_age(user_details['created_at'])
    
    # Calculate the total storage used for the header dropdown
    storage_used_str = get_total_storage_used(user_id)

    return render_template('settings.html', 
                           user=user_details, 
                           account_age=account_age,
                           main_storage=main_storage_str,
                           stash_storage=stash_storage_str,
                           storage_used=storage_used_str,
                           active_page='settings')

# User Settings Routes and Functions (2/7)
@app.route('/settings/about')
def about():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    storage_used_str = get_total_storage_used(user_id)
    account_age = "N/A" # Placeholder, can be calculated if needed

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    conn.close()

    if user and user.get('created_at'):
        account_age = calculate_account_age(user['created_at'])

    return render_template('about.html', 
                           active_page='settings_about', 
                           storage_used=storage_used_str, 
                           account_age=account_age)

# User Settings Routes and Functions (3/7)
@app.route('/settings/customize')
def customize():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    # We need to pass the same header info to this page as the others
    user_id = session['id']
    storage_used_str = get_total_storage_used(user_id)
    account_age = "N/A" # Placeholder, can be calculated if needed

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    conn.close()

    if user and user.get('created_at'):
        account_age = calculate_account_age(user['created_at'])

    return render_template('customize.html', 
                           active_page='settings_customize', 
                           storage_used=storage_used_str, 
                           account_age=account_age)

# User Settings Routes and Functions (4/7)
@app.route('/update_profile', methods=['POST'])
def update_profile():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    new_name = request.form.get('name')
    user_id = session['id']

    if not new_name or len(new_name) < 2:
        flash('Name must be at least 2 characters long.', 'error')
        return redirect(url_for('settings'))

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Update the 'name' column in the database
    cursor.execute("UPDATE users SET name = %s WHERE id = %s", (new_name, user_id))
    conn.commit()
    conn.close()

    # Update the display name in the session
    session['name'] = new_name
    flash('Profile updated successfully!', 'success')
    create_notification(user_id, f"You updated your display name to '{new_name}'.")
    return redirect(url_for('settings'))

# User Settings Routes and Functions (5/7)
@app.route('/upload_pfp', methods=['POST'])
def upload_pfp():
    if 'loggedin' not in session:
        return redirect(url_for('login'))
    
    if 'pfp' not in request.files:
        flash('No file part', 'error')
        return redirect(url_for('settings'))
        
    file = request.files['pfp']
    if file.filename == '':
        flash('No selected file', 'error')
        return redirect(url_for('settings'))

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Create a unique filename to avoid conflicts
        unique_filename = str(uuid.uuid4()) + os.path.splitext(filename)[1]
        file.save(os.path.join(app.config['PFP_FOLDER'], unique_filename))

        user_id = session['id']
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Before updating, get the old pfp filename to delete it
        cursor.execute("SELECT profile_pic FROM users WHERE id = %s", (user_id,))
        old_pfp = cursor.fetchone().get('profile_pic')

        # Update the database with the new pfp filename
        cursor.execute("UPDATE users SET profile_pic = %s WHERE id = %s", (unique_filename, user_id))
        conn.commit()
        conn.close()

        # Delete the old pfp file from the server
        if old_pfp:
            old_pfp_path = os.path.join(app.config['PFP_FOLDER'], old_pfp)
            if os.path.exists(old_pfp_path):
                os.remove(old_pfp_path)

        # Update the session
        session['profile_pic'] = unique_filename
        flash('Profile picture updated successfully!', 'success')
    else:
        flash('Invalid file type. Please upload a PNG, JPG, JPEG, or GIF.', 'error')

    return redirect(url_for('settings'))

# User Settings Routes and Functions (6/7)
@app.route('/uploads/pfps/<filename>')
def user_pfp(filename):
    return send_from_directory(app.config['PFP_FOLDER'], filename)

# User Settings Routes and Functions (7/7)
@app.route('/delete_account', methods=['POST'])
def delete_account():
    if 'loggedin' not in session:
        return redirect(url_for('login'))

    user_id = session['id']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # First, delete all associated files from filesystem
    cursor.execute("SELECT filename FROM files WHERE user_id = %s", (user_id,))
    files_to_delete = cursor.fetchall()
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
    for file in files_to_delete:
        file_path = os.path.join(user_folder, file['filename'])
        if os.path.exists(file_path):
            os.remove(file_path)
    
    # Then, delete the user's profile picture
    cursor.execute("SELECT profile_pic FROM users WHERE id = %s", (user_id,))
    pfp_to_delete = cursor.fetchone()
    if pfp_to_delete and pfp_to_delete.get('profile_pic'):
        pfp_path = os.path.join(app.config['PFP_FOLDER'], pfp_to_delete['profile_pic'])
        if os.path.exists(pfp_path):
            os.remove(pfp_path)

    # Finally, delete the user record itself (this will cascade and delete file records)
    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    conn.close()

    flash('Your account and all associated data have been permanently deleted.', 'success')
    # Log the user out by clearing the session
    session.clear()
    return redirect(url_for('login'))

# Background Task
if __name__ == '__main__':
    cleanup_thread = threading.Thread(target=run_stash_cleanup, daemon=True)
    cleanup_thread.start()

    app.run(debug=True)