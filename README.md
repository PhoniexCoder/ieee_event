# IEEE SB GEHU - Attendance Management PWA

A Progressive Web Application (PWA) for IEEE Student Branch GEHU attendance management with QR code scanning, Google Sheets integration, and offline support.

## 🚀 Features

### Core Functionality
- **QR Code Scanning**: Real-time camera-based QR code scanning for attendance
- **Google OAuth Authentication**: Secure login with role-based access (Admin/Volunteer)
- **Google Sheets Integration**: Automatic attendance tracking and data synchronization
- **Offline Support**: Works without internet connection with automatic sync when reconnected
- **PWA Capabilities**: Installable app with native-like experience

### User Roles
- **Volunteers**: Can scan QR codes and mark attendance
- **Admins**: Full access including student management, reports, and volunteer oversight

### Technical Features
- **Dark Futuristic Theme**: Cyberpunk-inspired UI with neon accents
- **Mobile-First Design**: Optimized for smartphones and tablets
- **Real-time Statistics**: Live attendance rates and student counts
- **Audit Logging**: Complete activity tracking for accountability
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Background Sync**: Automatic data synchronization when connectivity returns

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Authentication**: NextAuth.js with Google OAuth
- **Database**: Google Sheets API
- **QR Scanning**: @yudiel/react-qr-scanner
- **Offline Storage**: IndexedDB
- **PWA**: Service Worker, Web App Manifest

## 📋 Prerequisites

Before setting up the application, ensure you have:

1. **Node.js** (v18 or higher)
2. **Google Cloud Project** with Sheets API enabled
3. **Google OAuth Credentials** (Client ID and Secret)
4. **Google Service Account** with Sheets access
5. **Google Sheets Document** for student data

## ⚙️ Environment Variables

Create a `.env.local` file with the following variables:

\`\`\`env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Google Sheets API
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=your-google-sheets-id
\`\`\`

## 🚀 Getting Started

### 1. Clone and Install

\`\`\`bash
git clone <repository-url>
cd ieee-attendance-pwa
npm install
\`\`\`

### 2. Google Cloud Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one
   - Enable Google Sheets API

2. **Create Service Account**
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON key file
   - Extract email and private key for environment variables

3. **Setup OAuth Credentials**
   - Go to APIs & Credentials > Credentials
   - Create OAuth 2.0 Client ID
   - Add authorized origins and redirect URIs
   - Copy Client ID and Secret

### 3. Google Sheets Setup

1. **Create Google Sheet**
   - Create a new Google Sheets document
   - Share with service account email (Editor access)
   - Copy the sheet ID from URL

2. **Setup Sheet Structure**
   - Run the provided SQL script to understand the expected structure
   - Create sheets: "Students", "Attendance", "Audit_Logs"

### 4. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 PWA Installation

### Mobile Devices
1. Open the app in your mobile browser
2. Look for "Add to Home Screen" prompt
3. Follow installation instructions
4. App will appear on your home screen

### Desktop
1. Look for install icon in browser address bar
2. Click to install as desktop app
3. App will open in standalone window

## 🔧 Usage Guide

### For Volunteers
1. **Sign In**: Use your Google account to authenticate
2. **Scan QR Codes**: Point camera at student QR codes
3. **View Statistics**: Monitor attendance rates in real-time
4. **Offline Mode**: Continue scanning even without internet

### For Admins
1. **Access Admin Panel**: Additional navigation options available
2. **Manage Students**: View, search, and filter student records
3. **Export Reports**: Download attendance data as CSV
4. **View Audit Logs**: Monitor all volunteer activities
5. **Manage Volunteers**: Oversee volunteer access and roles

## 🔄 Offline Functionality

The app works seamlessly offline:

- **Offline Scanning**: QR codes are stored locally when offline
- **Background Sync**: Data syncs automatically when connection returns
- **Visual Indicators**: Clear online/offline status and sync progress
- **Data Persistence**: Uses IndexedDB for reliable local storage

## 🛡️ Security Features

- **Role-Based Access**: Automatic role assignment based on email domain
- **Secure Authentication**: Google OAuth with session management
- **Audit Trail**: Complete logging of all attendance actions
- **Data Validation**: Input sanitization and error handling
- **HTTPS Required**: Secure connections for camera access

## 📊 Google Sheets Structure

### Students Sheet
- Column A: Student ID
- Column B: Student Name
- Column C: Email
- Column D: Department
- Column E: Year

### Attendance Sheet
- Column A: Timestamp
- Column B: Student ID
- Column C: Student Name
- Column D: Volunteer ID
- Column E: Volunteer Name
- Column F: Status

### Audit_Logs Sheet
- Column A: Timestamp
- Column B: Action
- Column C: User ID
- Column D: User Name
- Column E: Details

## 🚀 Deployment

### Vercel Deployment
1. Push code to GitHub repository
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Environment Variables in Production
- Update `NEXTAUTH_URL` to production domain
- Ensure all Google Cloud credentials are properly configured
- Update OAuth redirect URIs for production domain

## 🔍 Troubleshooting

### Common Issues

**Camera Not Working**
- Ensure HTTPS is enabled (required for camera access)
- Check browser permissions for camera access
- Try different browsers (Chrome recommended)

**Google Sheets Connection Failed**
- Verify service account has access to the sheet
- Check environment variables are correctly set
- Ensure Sheets API is enabled in Google Cloud

**Authentication Issues**
- Verify OAuth credentials and redirect URIs
- Check NEXTAUTH_SECRET is set
- Ensure domain is authorized in Google Cloud

**Offline Sync Problems**
- Check browser IndexedDB support
- Clear browser cache and try again
- Verify network connectivity for sync

## 📈 Performance Optimization

- **Code Splitting**: Automatic route-based code splitting
- **Image Optimization**: Next.js automatic image optimization
- **Caching**: Service worker caches for offline performance
- **Bundle Analysis**: Use `npm run analyze` to check bundle size

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the IEEE SB GEHU technical team
- Check the troubleshooting section above

## 🔮 Future Enhancements

- **Bulk QR Code Generation**: Generate QR codes for all students
- **Advanced Analytics**: Detailed attendance reports and insights
- **Push Notifications**: Real-time attendance alerts
- **Multi-Event Support**: Handle multiple events simultaneously
- **Student Self-Service**: Allow students to view their attendance
