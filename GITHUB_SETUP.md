# GitHub Setup Guide for HACS

Follow these steps to publish your Kia Vehicle Card to GitHub and make it available via HACS.

---

## Step 1: Create GitHub Repository

1. **Go to GitHub**
   - Visit https://github.com/new
   - Or click the "+" icon → "New repository"

2. **Repository Settings**
   - **Name**: `kia-vehicle-card`
   - **Description**: "A beautiful Lovelace card for Kia and Hyundai vehicles"
   - **Visibility**: Public ✓ (required for HACS)
   - **DO NOT** initialize with README (we already have one)
   - Click "Create repository"

---

## Step 2: Push Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
cd /Users/auad/Projects/kia-vehicle-card

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/kia-vehicle-card.git

# Push code
git push -u origin main

# Push tag
git push origin v2.7.0
```

**Alternative with SSH:**
```bash
git remote add origin git@github.com:YOUR_USERNAME/kia-vehicle-card.git
git push -u origin main
git push origin v2.7.0
```

---

## Step 3: Create GitHub Release

1. **Go to Releases**
   - Navigate to your repository on GitHub
   - Click on "Releases" (right sidebar)
   - Click "Create a new release"

2. **Release Details**
   - **Tag**: Choose `v2.7.0`
   - **Release title**: `v2.7.0 - Enhanced Monitoring & Service Countdown`
   - **Description**: (Copy from below)

```markdown
## 🎉 What's New in v2.7.0

### ✨ New Features
- **Real-time Speed Indicator** - Shows current speed when vehicle is driving
- **Enhanced Service Countdown** - Color-coded progress bars with visual warnings
  - 🟢 Green: > 3,000 miles remaining
  - 🟡 Yellow: 1,000-3,000 miles (service soon)
  - 🔴 Red: < 1,000 miles (critical!)
- **7 New Sensors**
  - Tail Lamp Fault detection
  - Stop Lamp Fault detection
  - Hazard Lights active indicator
  - Car Battery Warning Level (numeric)
  - Link Status (connectivity)
  - RSA (Roadside Assistance) Status

### 🔧 Requirements
- `hyundai_kia_connect_api` >= v3.54.0
- `kia_uvo` >= v2.49.0
- Home Assistant >= 2023.1.0

### 📦 Installation
See [INSTALLATION.md](https://github.com/YOUR_USERNAME/kia-vehicle-card/blob/main/INSTALLATION.md) for details.

### 🐛 Bug Fixes
None in this release (feature-focused update)

### 📸 Screenshots
*(Add screenshots if available)*

---

**Full Changelog**: https://github.com/YOUR_USERNAME/kia-vehicle-card/commits/v2.7.0
```

3. **Attach Files** (optional but recommended)
   - Attach `kia-vehicle-card.js` as a release asset

4. **Publish**
   - Click "Publish release"

---

## Step 4: Enable GitHub Pages (Optional)

This helps with documentation:

1. Go to repository **Settings**
2. Scroll to **Pages** (left sidebar)
3. **Source**: Deploy from branch
4. **Branch**: main, /root
5. Click **Save**

---

## Step 5: Update README with Real URLs

After creating the repository, update these placeholders in README.md:

Find and replace:
- `YOUR_USERNAME` → Your actual GitHub username
- Update badge URLs
- Update screenshot placeholders

```bash
# Edit README.md
# Replace YOUR_USERNAME with your actual username
# Then commit:
git add README.md
git commit -m "Update README with correct GitHub URLs"
git push
```

---

## Step 6: Make it Available in HACS

### Option A: Add to HACS Default (Recommended)

1. **Fork the HACS Default Repository**
   - Go to https://github.com/hacs/default
   - Click "Fork"

2. **Add Your Repository**
   - Edit `lovelace/lovelace.json`
   - Add your entry (alphabetically):
   ```json
   {
     "name": "Kia Vehicle Card",
     "description": "A beautiful Lovelace card for Kia and Hyundai vehicles",
     "domain": "https://github.com/YOUR_USERNAME/kia-vehicle-card",
     "authors": ["YOUR_USERNAME"]
   }
   ```

3. **Create Pull Request**
   - Commit changes
   - Create PR to HACS/default
   - Wait for review and approval

### Option B: Custom Repository (Immediate)

Users can add your repository manually:

1. Open HACS → Frontend
2. Click ⋮ menu → Custom repositories
3. Add: `https://github.com/YOUR_USERNAME/kia-vehicle-card`
4. Category: Lovelace
5. Click Add

---

## Step 7: Add Topics/Tags

Make your repository discoverable:

1. Go to repository homepage
2. Click the ⚙️ gear icon next to "About"
3. Add topics:
   - `home-assistant`
   - `lovelace-custom-card`
   - `hacs`
   - `kia`
   - `hyundai`
   - `vehicle`
   - `homeassistant-frontend`

---

## Step 8: Future Releases

When you make updates:

1. **Update version** in `kia-vehicle-card.js`
2. **Commit changes**
   ```bash
   git add .
   git commit -m "Version 2.8.0 - Description of changes"
   ```

3. **Create and push tag**
   ```bash
   git tag -a v2.8.0 -m "Release notes here"
   git push origin main
   git push origin v2.8.0
   ```

4. **Create GitHub Release**
   - Go to Releases → Draft a new release
   - Select the new tag
   - Add release notes
   - Publish

---

## Verification Checklist

After setup, verify:

- [ ] Repository is public
- [ ] README displays correctly
- [ ] Release v2.7.0 exists with tag
- [ ] `kia-vehicle-card.js` file is in root
- [ ] `hacs.json` file exists
- [ ] Topics/tags are added
- [ ] License file exists (MIT)

---

## Testing Installation

Test that users can install:

1. In a test Home Assistant instance
2. Add your repository as custom HACS repository
3. Try to install the card
4. Verify it loads correctly
5. Test card functionality

---

## Useful Commands

```bash
# Check current remote
git remote -v

# View commit history
git log --oneline --graph

# View tags
git tag -l

# Create new release branch
git checkout -b release/v2.8.0

# Delete a tag (if needed)
git tag -d v2.7.0
git push origin :refs/tags/v2.7.0
```

---

## Need Help?

- [GitHub Docs - Creating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [HACS Documentation](https://hacs.xyz/)
- [HACS Default Repositories](https://github.com/hacs/default)

---

**Ready to publish?** Follow the steps above and your card will be available to the Home Assistant community! 🚀
