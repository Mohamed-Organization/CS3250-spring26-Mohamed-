## MSU Denver CS3250 - Spring26

## Anonymous Theme Switcher

Anonymous Theme Switcher is a Firefox extension that allows users to easily switch between different theme groups. The extension provides a simple interface for selecting and applying themes directly from the browser.

## Project Features

- Switch between predefined browser themes
- Simple popup interface
- Automated code quality checks using ESLint
- CI pipeline using GitHub Actions
- JSDoc-generated documentation

---

## Project Structure

```text
project-root
│
├─ src/                 # Source code for the extension
│  ├─ popup.js
│  ├─ background.js
│  └─ popup.html
│
├─ docs/                # Generated JSDoc HTML documentation
│  └─ index.html
│
├─ manifest.json        # Firefox extension configuration
├─ package.json         # Project dependencies and scripts
│
└─ .github/
   └─ workflows/
      └─ ci.yml         # CI pipeline configuration
```
---

## Installation

1. Clone the repository
2. Open the project in your preferred IDE
3. Install dependencies
npm install

---

## Running the Extension in Firefox

1. Open **Firefox**
2. In the search bar navigate to: about:debugging
3. Click on **This Firefox**
4. Click **Load Temporary Add-On**
5. Select the 'manifest.json' file in the project folder.

The extension will now load in Firefox.

---

## CI/CD Pipeline

This project uses **GitHub Actions** for continuous integration.

The pipeline automatically runs when code is pushed or a pull request is created.

The CI workflow performs the following steps:
1. Checks out the repository
2. Sets up a Node.js environment
3. Installs dependencies
4. Runs ESLint to check code quality

This helps ensure that all code added to the project meets our coding standards

---

## Viewing & Documentation

JSDoc is used to generate HTML documentation from comments in the JavaScript code

To view the documenation:
1. Open the file docs/index.html
2. Right click on the file
3. Click on **Open with a live server**
This wil display the documentation as a website in the browser

---

## Authors

Team Anonymous 

- Ramin
- Daniel
- Alejandro
- Julian
- Moehamed