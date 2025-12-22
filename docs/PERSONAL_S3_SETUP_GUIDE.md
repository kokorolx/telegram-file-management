# Personal S3 Backup Configuration Guide

This guide explains how to configure your personal S3 or Cloudflare R2 bucket for encrypted file backups.

## Overview

Telegram Vault supports two levels of S3 backup configuration:

1. **Global S3** - Set by server administrators via environment variables (shared across all users)
2. **Personal S3** - User-configured, stored encrypted in the database

Personal S3 configurations take priority and are **always preferred** if available.

## Security Architecture

Your S3 credentials are protected by **two layers of encryption**:

```
User's S3 Config (plaintext)
    ↓
[Encrypted with Master Password] → Stored in Database
    ↓
[Browser fetches & decrypts with Master Password]
    ↓
[Re-encrypted with Server's RSA Public Key]
    ↓
[Sent to Server in re-encrypted form]
    ↓
[Server decrypts with Private Key (in memory only)]
    ↓
[Credentials used for S3 upload/download]
    ↓
[Credentials immediately discarded]
```

**Key Security Properties:**
- Your Master Password **never** leaves your browser
- Your plain-text S3 credentials **never** reach the server
- Credentials only exist in server memory during active upload/download
- Two encryption layers protect credentials in transit (Master Password + RSA-4096)

## Setup Instructions

### 1. Create an S3 Bucket

#### AWS S3
1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click "Create bucket"
3. Enter bucket name (must be globally unique, e.g., `my-vault-backups`)
4. Choose region (same as your app for lower latency)
5. Keep default settings (Block Public Access = enabled)
6. Click "Create bucket"

#### Cloudflare R2
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2
2. Click "Create bucket"
3. Enter bucket name (e.g., `my-vault-backups`)
4. Choose region (or auto)
5. Click "Create bucket"

### 2. Create API Credentials

#### AWS S3
1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Users" → "Create user"
3. Enter username (e.g., `telegram-vault-backup`)
4. Skip "Set permissions" for now
5. Click "Create user"
6. Click on the user you just created
7. Go to "Security credentials" tab
8. Click "Create access key"
9. Choose "Application running outside AWS"
10. Copy **Access Key ID** and **Secret Access Key**

**Add inline policy to user:**
1. Go to "Permissions" tab
2. Click "Add inline policy"
3. Choose "JSON" editor
4. Paste the policy below (replace `my-vault-backups` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-vault-backups",
        "arn:aws:s3:::my-vault-backups/*"
      ]
    }
  ]
}
```

5. Click "Review policy" → "Create policy"

#### Cloudflare R2
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Account → R2 API Tokens
2. Click "Create API token"
3. Choose "Edit" for the permission level
4. Select "Include specific buckets" and choose your bucket
5. Click "Create API token"
6. Copy **Access Key ID** and **Secret Access Key**

### 3. Configure in Telegram Vault

1. Log into your Telegram Vault account
2. Go to **Settings** → **Backup Storage** (or similar S3 configuration section)
3. Click **Configure Personal S3**
4. Fill in the following details:

| Field | Value | Example |
|-------|-------|---------|
| **Provider** | `s3` (AWS S3) or `r2` (Cloudflare R2) | `s3` |
| **Bucket Name** | Your S3 bucket name | `my-vault-backups` |
| **Access Key ID** | Your API access key | `AKIA...` |
| **Secret Access Key** | Your API secret key | `abc123...` |
| **Region** | AWS region (S3 only) | `us-east-1` |
| **Endpoint** | Custom S3 endpoint (R2 only) | `https://abc123.r2.cloudflarestorage.com` |
| **Storage Class** | Cost optimization class | `STANDARD` |

5. Click **Save Configuration**
6. Your configuration is now encrypted and stored securely

## Configuration Details

### AWS S3 Regions

Choose the region closest to your server for optimal performance:

- `us-east-1` - N. Virginia (default)
- `us-west-2` - Oregon
- `eu-west-1` - Ireland
- `eu-central-1` - Frankfurt
- `ap-southeast-1` - Singapore
- [Full list](https://docs.aws.amazon.com/general/latest/gr/s3.html#s3_region)

### Storage Classes

**AWS S3:**
- `STANDARD` - Frequently accessed data (default, high cost)
- `STANDARD_IA` - Infrequent access, monthly retrieval (lower cost)
- `INTELLIGENT_TIERING` - Automatic optimization
- `GLACIER_IR` - Archived data, retrieval in minutes

**Cloudflare R2:**
- `STANDARD` - Always available (default)
- `IA` - Infrequent access (lower egress cost)

## Testing Your Configuration

After setup, test your configuration:

1. Upload a small file (e.g., 1MB) in Telegram Vault
2. Watch the upload progress
3. Once complete, simulate Telegram failure by:
   - Temporarily blocking Telegram's API (e.g., in network settings)
   - Try downloading the file
   - It should automatically fall back to S3
4. Verify the download works from S3

## Troubleshooting

### "Access Denied" Error
- **Check:** Access Key ID and Secret are correct
- **Check:** IAM policy is attached to the user
- **Check:** Bucket exists and is accessible

### "Invalid Bucket Name" Error
- **Check:** Bucket name is exactly correct (case-sensitive)
- **Check:** Bucket exists in the specified region

### "Slow Download from S3"
- **Check:** You're in a region far from the bucket (consider creating another bucket closer)
- **Check:** Storage Class is `STANDARD` (not `GLACIER_IR`)

### Files Not Backing Up to S3
- **Check:** Personal S3 is configured in Settings
- **Check:** IAM policy allows `s3:PutObject` action
- **Check:** Bucket has sufficient space
- **Check:** Server logs for decryption errors

### Can't Access Backed-Up Files from S3
- **Check:** IAM policy allows `s3:GetObject` action
- **Check:** Presigned URL hasn't expired (1 hour default)
- **Check:** File actually exists in S3 bucket

## Updating Your Configuration

1. Go to **Settings** → **Backup Storage**
2. Click **Edit Configuration**
3. Update any fields
4. Click **Save Changes**

Your new configuration takes effect immediately for future uploads.

## Removing Your Configuration

1. Go to **Settings** → **Backup Storage**
2. Click **Remove Configuration**
3. Confirm the action

Existing backups in S3 **remain untouched**. Only future uploads will fall back to Global S3 (if available).

## FAQ

**Q: What happens if I lose my Master Password?**
A: Your S3 credentials cannot be recovered. Set up a new configuration with your new Master Password.

**Q: Can the server see my S3 credentials?**
A: No. Your credentials are encrypted before reaching the server and only decrypted in server memory during active use.

**Q: Do I need to pay for S3 backups?**
A: Yes. AWS S3 and Cloudflare R2 have storage and bandwidth costs. Check their pricing:
- [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [Cloudflare R2 Pricing](https://www.cloudflare.com/products/r2/pricing/)

**Q: Can I change my S3 bucket later?**
A: Yes. Update your configuration anytime. Existing backups remain in the old bucket.

**Q: What if both Telegram and S3 fail?**
A: Files cannot be recovered. Always maintain backups elsewhere if critical.

**Q: Is S3 mandatory?**
A: No. Telegram Vault works without it. S3 is optional for increased redundancy.

**Q: Can I use a different S3-compatible provider?**
A: Yes, if it supports standard S3 API. Enter the custom endpoint in settings.

## Advanced: Encryption Scheme Details

For developers/auditors:

**At Rest (Database):**
- Algorithm: AES-256-GCM
- Key: Derived from Master Password using PBKDF2 (100,000 iterations)
- Payload: JSON S3 config encrypted with per-user encryption salt

**In Transit (Browser ↔ Server):**
- Algorithm: RSA-4096-OAEP with SHA-256
- Server generates unique 4096-bit key pair on first startup
- Public key sent to browser (no auth required)
- Browser re-encrypts credentials using public key
- Server decrypts using private key (never leaves server)

**At Server:**
- Credentials exist in memory only during active S3 operations
- No persistence to disk or logs
- Automatically garbage collected after use

## Support

For issues or questions:
- Check the [Troubleshooting](#troubleshooting) section above
- Review server logs for detailed error messages
- Open an issue on GitHub with relevant logs (sanitized of credentials)
