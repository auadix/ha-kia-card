# Quick Start - Publish to GitHub in 5 Minutes! ⚡

## 🚀 Fastest Path to Publishing

### Step 1: Create GitHub Repository (2 min)

1. Go to **https://github.com/new**
2. Set these values:
   - **Repository name**: `kia-vehicle-card`
   - **Description**: "A beautiful Lovelace card for Kia and Hyundai vehicles"
   - **Public** ✓
   - **Don't** initialize with anything
3. Click **"Create repository"**

### Step 2: Push Your Code (1 min)

Copy the commands GitHub shows you, or use these:

```bash
cd /Users/auad/Projects/kia-vehicle-card

# Replace YOUR_USERNAME with your GitHub username!
git remote add origin https://github.com/YOUR_USERNAME/kia-vehicle-card.git

git push -u origin main
git push origin v2.7.0
```

### Step 3: Update README (1 min)

Before people start using it, quickly update:

```bash
# Find and replace YOUR_USERNAME in README.md with your actual username
# Can do manually or:
sed -i '' 's/YOUR_USERNAME/your-actual-username/g' README.md
git add README.md
git commit -m "Update README with correct URLs"
git push
```

### Step 4: Create Release (1 min)

1. Go to your repository on GitHub
2. Click **"Releases"** → **"Create a new release"**
3. Choose existing tag: **v2.7.0**
4. Release title: **v2.7.0 - Enhanced Monitoring & Service Countdown**
5. Description: Copy from the box below
6. Click **"Publish release"**

**Release Description:**
```markdown
## 🎉 First Public Release!

A beautiful, modern Lovelace card for Kia and Hyundai vehicles.

### ✨ Features
- Complete vehicle monitoring (fuel, battery, range, speed)
- Enhanced service countdown with color-coded warnings
- 7 comprehensive sensors for faults and status
- Climate control with smart presets
- Vehicle controls (lock, climate, horn, update)
- Modern dark-themed design

### 📦 Installation
See [INSTALLATION.md](https://github.com/YOUR_USERNAME/kia-vehicle-card/blob/main/INSTALLATION.md)

### 🔧 Requirements
- hyundai_kia_connect_api >= v3.54.0
- kia_uvo >= v2.49.0

---
**Full documentation**: [README.md](https://github.com/YOUR_USERNAME/kia-vehicle-card/blob/main/README.md)
```

## ✅ Done!

Your card is now **publicly available**!

### Share it!

Users can now install via HACS:
1. HACS → Frontend → ⋮ → Custom repositories
2. Add: `https://github.com/YOUR_USERNAME/kia-vehicle-card`
3. Category: Lovelace
4. Install!

---

## 📢 Optional: Submit to HACS Default

Want it in the default HACS store? (Takes a few days for approval)

1. Fork https://github.com/hacs/default
2. Edit `lovelace/lovelace.json`
3. Add (alphabetically):
```json
{
  "name": "Kia Vehicle Card",
  "description": "A beautiful Lovelace card for Kia and Hyundai vehicles",
  "domain": "https://github.com/YOUR_USERNAME/kia-vehicle-card",
  "authors": ["YOUR_USERNAME"]
}
```
4. Commit and create Pull Request
5. Wait for HACS team to review

---

## 🎨 Make it Pretty (Optional)

### Add Topics
On your repository page:
- Click ⚙️ next to "About"
- Add: `home-assistant`, `lovelace-custom-card`, `hacs`, `kia`, `hyundai`

### Add Screenshots
Take screenshots and add to README.md to replace placeholders

### Star Your Own Repo
Why not? ⭐

---

## 🐛 Test It!

Before announcing:

1. In a test HA instance, add as custom repository
2. Install via HACS
3. Add card to dashboard
4. Verify it works

---

## 📣 Announce It!

Once tested, share with the community:

- **Home Assistant Forum**: https://community.home-assistant.io/
- **Reddit**: r/homeassistant
- **GitHub**: Comment on kia_uvo integration repo

---

**That's it! You've published an open-source Home Assistant card! 🎉**

Repository: https://github.com/YOUR_USERNAME/kia-vehicle-card
