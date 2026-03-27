# AKAN Party Manager - Complete Setup Guide

## Prerequisites
- Node.js 18+ installed (download from https://nodejs.org)
- A Google account
- A Gmail account for sending emails (or any SMTP server)

---

## STEP 1: Google Sheets API Setup

### 1.1 Create a Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click "Select a project" -> "New Project"
3. Name it "AKAN Party Manager" -> Create
4. Select the new project

### 1.2 Enable Google Sheets API
1. Go to "APIs & Services" -> "Library"
2. Search for "Google Sheets API"
3. Click it and press "Enable"

### 1.3 Create a Service Account
1. Go to "APIs & Services" -> "Credentials"
2. Click "Create Credentials" -> "Service Account"
3. Name: "akan-sheets-service"
4. Click "Create and Continue" -> "Done"
5. Click on the service account email you just created
6. Go to "Keys" tab -> "Add Key" -> "Create New Key" -> JSON -> Create
7. A JSON file will download. **Keep this safe!**

### 1.4 Create Your Google Sheet
1. Go to https://sheets.google.com and create a new spreadsheet
2. Name it "AKAN Party Manager"
3. Rename the first sheet tab to "Party Bookings"
4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SHEET_ID/edit`
5. **Share the spreadsheet** with the service account email
   (found in the JSON file as `client_email`)
   - Click "Share" button -> paste the service account email -> Editor access

### 1.5 Get Your Credentials
From the downloaded JSON file, you need:
- `client_email` -> This is your GOOGLE_SERVICE_ACCOUNT_EMAIL
- `private_key` -> This is your GOOGLE_PRIVATE_KEY

---

## STEP 2: Email Setup (Gmail)

### Using Gmail:
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication (required)
3. Go to https://myaccount.google.com/apppasswords
4. Generate an App Password for "Mail"
5. Copy the 16-character password

### SMTP Settings for Gmail:
- SMTP_HOST=smtp.gmail.com
- SMTP_PORT=587
- SMTP_USER=your-gmail@gmail.com
- SMTP_PASS=your-16-char-app-password

---

## STEP 3: Backend Setup

```bash
# Navigate to backend folder
cd akan-party-manager/backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Edit the .env file with your actual values:
```
PORT=5000
NODE_ENV=development
JWT_SECRET=generate-a-random-string-here-at-least-32-chars
GOOGLE_SHEETS_ID=your-sheet-id-from-step-1.4
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
SALES_EMAIL=sales-team@email.com
MANAGER_EMAIL=manager@email.com
ADMIN_EMAIL=admin@email.com
FRONTEND_URL=http://localhost:3000
```

**Important:** The GOOGLE_PRIVATE_KEY must be in quotes and have `\n` for newlines.

### Start the backend:
```bash
npm run dev
```

You should see:
```
AKAN Party Manager API running on port 5000
Default admin account created (admin / admin123)
```

---

## STEP 4: Frontend Setup

```bash
# Open a NEW terminal
cd akan-party-manager/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will open at **http://localhost:3000**

---

## STEP 5: First Login

1. Open http://localhost:3000
2. Login with: **admin** / **admin123**
3. Go to Settings -> Add new users for your team

### Default Roles:
| Role | Can Do |
|------|--------|
| GRE | Add parties, view data |
| SALES | Update status, packages, payments |
| MANAGER | Full update access, reports |
| ADMIN | Everything including delete & user management |

---

## STEP 6: Verify Google Sheets Sync

1. Add a party through the website
2. Open your Google Sheet - the data should appear immediately
3. Edit a value in the Google Sheet
4. Refresh the website - changes should reflect

---

## Production Deployment (VPS / Hostinger)

### Build the frontend:
```bash
cd frontend
npm run build
```

### Server setup (Ubuntu VPS):
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Upload your project to the server
# Then:
cd akan-party-manager/backend
npm install --production
cp .env.example .env
# Edit .env with production values

# Copy frontend build to backend
cp -r ../frontend/dist ./public

# Start with PM2
pm2 start server.js --name akan-party-manager
pm2 save
pm2 startup
```

### Add static file serving to server.js for production:
Add this line before the routes in server.js:
```javascript
app.use(express.static(path.join(__dirname, 'public')));
```

### Nginx reverse proxy (recommended):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Troubleshooting

### "Failed to start server"
- Check that your .env file has correct Google Sheets credentials
- Make sure the service account has Editor access to the sheet

### "Invalid credentials" on login
- Default login: admin / admin123
- Check that the Users sheet was created in Google Sheets

### Emails not sending
- Verify SMTP credentials
- For Gmail: ensure App Password is used (not regular password)
- Test: Settings -> Notifications -> "Test Email"

### Data not syncing
- Verify the Sheet ID in .env
- Check that the sheet tab is named "Party Bookings"
- Verify service account email has Editor access

---

## Project Structure

```
akan-party-manager/
├── backend/
│   ├── server.js              # Express server entry
│   ├── config/google-sheets.js # Google Sheets API config
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   └── roleCheck.js       # Role-based access
│   ├── routes/
│   │   ├── auth.js            # Login, register, user management
│   │   ├── parties.js         # Party CRUD + filters
│   │   ├── reports.js         # Report generation
│   │   └── notifications.js   # Email notifications
│   ├── services/
│   │   ├── sheetsService.js   # Google Sheets read/write
│   │   ├── emailService.js    # Email sending
│   │   └── reportService.js   # Report compilation
│   └── utils/calculations.js  # Auto-calculations
├── frontend/
│   ├── src/
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # Auth & Theme contexts
│   │   ├── services/api.js    # API client
│   │   └── utils/helpers.js   # Utility functions
│   └── index.html
└── SETUP_GUIDE.md
```
