/**
 * Plutonium Dependency Checker Module
 *
 * Analyzes dependencies across JavaScript and Python components,
 * finding inconsistencies and generating reports.
 */

// Guard against direct JS imports
if (typeof __filename !== "undefined" && __filename.endsWith(".js")) {
	throw new Error("Do not import the .js version; use './dependency-checker.cjs'")
}

const fs = require("fs")
const path = require("path")
const semver = require("semver")

// Configuration paths are relative to repo root
const ROOT_DIR = path.resolve(__dirname, "../..")
const MAIN_PACKAGE_JSON = path.join(ROOT_DIR, "package.json")
const WEBVIEW_PACKAGE_JSON = path.join(ROOT_DIR, "webview-ui", "package.json")
const PYTHON_REQUIREMENTS = path.join(ROOT_DIR, "python_backend", "requirements.txt")
const REPORTS_DIR = path.join(ROOT_DIR, "reports")
const PLUTONIUM_ICON = path.join(__dirname, "assets", "plutonium-icon.png")

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
	fs.mkdirSync(REPORTS_DIR, { recursive: true })
}

/**
 * Parse version string to ensure valid semver format
 * Returns a normalized version string or null if invalid
 */
function parseVersion(version) {
	if (!version) {
		return null
	}

	// Remove any leading ^ or ~ characters
	let cleanVersion = version.replace(/^[\^~]/, "")

	// Handle "x" versions like "20.x"
	if (cleanVersion.includes("x")) {
		cleanVersion = cleanVersion.replace(/\.x$/, ".0")
	}

	// Try to coerce to a valid semver
	return semver.valid(semver.coerce(cleanVersion))
}

/**
 * Get the higher version between two version strings
 */
function getHigherVersion(v1, v2) {
	const parsedV1 = parseVersion(v1)
	const parsedV2 = parseVersion(v2)

	if (!parsedV1) {
		return v2
	}
	if (!parsedV2) {
		return v1
	}

	// Compare and return the higher version with the original prefix (^ or ~)
	const prefix1 = v1.startsWith("^") ? "^" : v1.startsWith("~") ? "~" : ""
	const prefix2 = v2.startsWith("^") ? "^" : v2.startsWith("~") ? "~" : ""

	// Choose the prefix from the higher version, or default to ^ for compatibility
	const prefix = semver.gt(parsedV1, parsedV2) ? prefix1 : prefix2 || "^"

	return prefix + (semver.gt(parsedV1, parsedV2) ? parsedV1 : parsedV2)
}

/**
 * Read and parse Python requirements from a file
 */
function parsePythonRequirements(filePath) {
	const results = {
		packages: [],
		unpinned: [],
	}

	try {
		if (fs.existsSync(filePath)) {
			const content = fs.readFileSync(filePath, "utf8")
			const lines = content.split("\n")

			for (const line of lines) {
				const trimmedLine = line.trim()
				// Skip comments and empty lines
				if (!trimmedLine || trimmedLine.startsWith("#")) {
					continue
				}

				// Extract package name and version
				let packageName = trimmedLine.split("#")[0].trim()
				let packageVersion = null

				if (packageName.includes("==")) {
					;[packageName, packageVersion] = packageName.split("==")
					packageVersion = "==" + packageVersion
				} else if (packageName.includes(">=")) {
					;[packageName, packageVersion] = packageName.split(">=")
					packageVersion = ">=" + packageVersion
				} else if (packageName.includes("<=")) {
					;[packageName, packageVersion] = packageName.split("<=")
					packageVersion = "<=" + packageVersion
				} else if (packageName.includes(">")) {
					;[packageName, packageVersion] = packageName.split(">")
					packageVersion = ">" + packageVersion
				} else if (packageName.includes("<")) {
					;[packageName, packageVersion] = packageName.split("<")
					packageVersion = "<" + packageVersion
				} else if (packageName.includes("~=")) {
					;[packageName, packageVersion] = packageName.split("~=")
					packageVersion = "~=" + packageVersion
				} else {
					results.unpinned.push(packageName)
				}

				packageName = packageName.trim()

				results.packages.push({
					name: packageName,
					version: packageVersion ? packageVersion.trim() : null,
					file: path.basename(filePath),
				})
			}
		}
	} catch (err) {
		console.error(`Error parsing ${filePath}: ${err.message}`)
	}

	return results
}

/**
 * Generate HTML report for dependencies
 */
function generateHtmlReport(data) {
	const timestamp = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")

	// Create HTML content with styling
	const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plutonium Dependency Analysis</title>
  <style>
    :root {
      color-scheme: dark;
      --primary-color: #bb86fc;
      --secondary-color: #03dac6;
      --warning-color: #ffb74d;
      --error-color: #cf6679;
      --success-color: #81c784;
      --background-color: #121212;
      --card-bg: #1e1e1e;
      --text-color: #e0e0e0;
      --border-color: #333333;
    }
    
    @media (prefers-color-scheme: light) {
      :root {
        color-scheme: light;
        --primary-color: #6200ee;
        --secondary-color: #03dac6;
        --warning-color: #ff9800;
        --error-color: #b00020;
        --success-color: #4caf50;
        --background-color: #f5f5f5;
        --card-bg: #ffffff;
        --text-color: #333333;
        --border-color: #dddddd;
      }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--background-color);
      margin: 0;
      padding: 0;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    
    header {
      background-color: rgba(0, 0, 0, 0.2);
      padding: 30px 0;
      text-align: center;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 40px;
    }
    
    h1, h2, h3 {
      color: var(--primary-color);
      font-weight: 600;
    }
    
    .card {
      background-color: var(--card-bg);
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 25px;
      margin-bottom: 30px;
      border: 1px solid var(--border-color);
    }
    
    .info { color: var(--primary-color); }
    .warning { color: var(--warning-color); }
    .error { color: var(--error-color); }
    .success { color: var(--success-color); }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 0 0 1px var(--border-color);
    }
    
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    
    th {
      background-color: rgba(187, 134, 252, 0.1);
      font-weight: 600;
      color: var(--primary-color);
    }
    
    tr:hover {
      background-color: rgba(255, 255, 255, 0.03);
    }
    
    .tabs {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .tab {
      padding: 12px 24px;
      cursor: pointer;
      transition: all 0.3s ease;
      border-bottom: 2px solid transparent;
      margin-right: 4px;
    }
    
    .tab:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
    
    .tab.active {
      border-bottom-color: var(--primary-color);
      background-color: rgba(187, 134, 252, 0.1);
      color: var(--primary-color);
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
      animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .summary-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, rgba(187, 134, 252, 0.05), rgba(3, 218, 198, 0.05));
      border-radius: 8px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--border-color);
    }
    
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      margin: 10px 0;
    }
    
    .search-container {
      margin-bottom: 15px;
    }
    
    .search-box {
      width: 100%;
      padding: 10px 15px;
      font-size: 16px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-color);
    }
    
    footer {
      margin-top: 60px;
      padding: 20px 0;
      text-align: center;
      font-size: 14px;
      color: var(--text-color);
      opacity: 0.7;
      border-top: 1px solid var(--border-color);
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>Dependency Analysis Report</h1>
      <p>Generated on ${timestamp}</p>
    </div>
  </header>
  
  <div class="container">
    <div class="card">
      <h2>Summary</h2>
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-label">Python Packages</div>
          <div class="stat-value">${data.pythonPackages.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Main npm Packages</div>
          <div class="stat-value">${data.mainPackages.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Webview npm Packages</div>
          <div class="stat-value">${data.webviewPackages.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Shared Packages</div>
          <div class="stat-value">${data.sharedPackages.length}</div>
        </div>
      </div>
    </div>
    
    <div class="tabs">
      <div class="tab active" data-tab="overview">Overview</div>
      <div class="tab" data-tab="npm">npm Packages</div>
      <div class="tab" data-tab="python">Python Packages</div>
      <div class="tab" data-tab="cross-language">Cross-Language</div>
    </div>
    
    <div class="tab-content active" id="tab-overview">
      <div class="card">
        <h2>Dependency Overview</h2>
        
        ${
			data.npmInconsistencies.length > 0
				? `
        <h3>npm Version Inconsistencies</h3>
        <p>The following packages have different versions between main and webview environments:</p>
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Main Version</th>
              <th>Webview Version</th>
              <th>Recommended</th>
            </tr>
          </thead>
          <tbody>
            ${data.npmInconsistencies
				.map(
					(item) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.mainVersion}</td>
                <td>${item.webviewVersion}</td>
                <td><span class="success">${item.recommended}</span></td>
              </tr>
            `,
				)
				.join("")}
          </tbody>
        </table>
        `
				: "<p>✅ No npm version inconsistencies found.</p>"
		}
        
        ${
			data.crossLanguageIssues.length > 0
				? `
        <h3>Cross-language Dependency Conflicts</h3>
        <p>Potential version conflicts between Python and JavaScript packages:</p>
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Python Version</th>
              <th>JavaScript Version</th>
            </tr>
          </thead>
          <tbody>
            ${data.crossLanguageIssues
				.map(
					(item) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.pythonVersion}</td>
                <td>${item.jsVersion}</td>
              </tr>
            `,
				)
				.join("")}
          </tbody>
        </table>
        <p class="info"><i>Note: Review these packages to ensure version compatibility between languages</i></p>
        `
				: "<p>✅ No cross-language dependency conflicts found.</p>"
		}
        
        ${
			data.unpinnedPythonDeps.length > 0
				? `
        <h3>Unpinned Python Dependencies</h3>
        <p>The following Python dependencies are not pinned to specific versions:</p>
        <ul>
          ${data.unpinnedPythonDeps.map((dep) => `<li>${dep}</li>`).join("")}
        </ul>
        <p class="warning">Unpinned dependencies can lead to inconsistent builds and security issues. Consider pinning these dependencies to specific versions.</p>
        `
				: "<p>✅ All Python dependencies are properly pinned.</p>"
		}
      </div>
    </div>
    
    <div class="tab-content" id="tab-npm">
      <div class="card">
        <h2>npm Packages</h2>
        
        <h3>Main npm Dependencies (${data.mainPackages.length})</h3>
        <div class="search-container">
          <input type="text" class="search-box" id="main-npm-search" placeholder="Search packages...">
        </div>
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Version</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody class="searchable-content" id="main-npm-packages">
            ${data.mainPackages
				.map(
					(pkg) => `
              <tr>
                <td>${pkg.name}</td>
                <td>${pkg.version}</td>
                <td>${pkg.type}</td>
              </tr>
            `,
				)
				.join("")}
          </tbody>
        </table>
        
        <h3>Webview npm Dependencies (${data.webviewPackages.length})</h3>
        <div class="search-container">
          <input type="text" class="search-box" id="webview-npm-search" placeholder="Search packages...">
        </div>
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Version</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody class="searchable-content" id="webview-npm-packages">
            ${data.webviewPackages
				.map(
					(pkg) => `
              <tr>
                <td>${pkg.name}</td>
                <td>${pkg.version}</td>
                <td>${pkg.type}</td>
              </tr>
            `,
				)
				.join("")}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="tab-content" id="tab-python">
      <div class="card">
        <h2>Python Dependencies</h2>
        
        <div class="search-container">
          <input type="text" class="search-box" id="python-packages-search" placeholder="Search packages...">
        </div>
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Version</th>
            </tr>
          </thead>
          <tbody class="searchable-content" id="python-packages">
            ${data.pythonPackages
				.map(
					(pkg) => `
              <tr>
                <td>${pkg.name}</td>
                <td>${pkg.version || "<i>not pinned</i>"}</td>
              </tr>
            `,
				)
				.join("")}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="tab-content" id="tab-cross-language">
      <div class="card">
        <h2>Cross-Language Dependencies</h2>
        
        ${
			data.crossLanguageIssues.length > 0
				? `
        <p>The following packages exist in both Python and JavaScript environments with potentially incompatible versions:</p>
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Python Version</th>
              <th>JavaScript Version</th>
            </tr>
          </thead>
          <tbody>
            ${data.crossLanguageIssues
				.map(
					(item) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.pythonVersion}</td>
                <td>${item.jsVersion}</td>
              </tr>
            `,
				)
				.join("")}
          </tbody>
        </table>
        <p>To resolve these issues, consider:</p>
        <ul>
          <li>Adding version mappings in plutonium-config.json</li>
          <li>Updating either the Python or JavaScript package to a compatible version</li>
          <li>Verifying the packages are truly equivalent (some may have similar names but different functionality)</li>
        </ul>
        `
				: `<p>✅ No cross-language dependency conflicts detected.</p>`
		}
      </div>
    </div>
    
    <footer>
      Generated by Plutonium - Apex CodeGenesis Development Toolkit
    </footer>
  </div>
  
  <script>
    // Tab switching functionality
    document.addEventListener('DOMContentLoaded', function() {
      // Tab switching
      const tabs = document.querySelectorAll('.tab');
      const tabContents = document.querySelectorAll('.tab-content');
      
      tabs.forEach(tab => {
        tab.addEventListener('click', function() {
          // Remove active class from all tabs and content
          tabs.forEach(t => t.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));
          
          // Add active class to clicked tab and corresponding content
          tab.classList.add('active');
          document.getElementById('tab-' + tab.getAttribute('data-tab')).classList.add('active');
        });
      });
      
      // Search functionality
      function setupSearch(inputId, tableId) {
        const searchInput = document.getElementById(inputId);
        const table = document.getElementById(tableId);
        
        if (searchInput && table) {
          searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = table.getElementsByTagName('tr');
            
            Array.from(rows).forEach(row => {
              const text = row.textContent.toLowerCase();
              row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
          });
        }
      }
      
      setupSearch('main-npm-search', 'main-npm-packages');
      setupSearch('webview-npm-search', 'webview-npm-packages');
      setupSearch('python-packages-search', 'python-packages');
    });
  </script>
</body>
</html>`

	// Write HTML report to file
	const reportPath = path.join(REPORTS_DIR, "dependency-report.html")
	fs.writeFileSync(reportPath, htmlContent)

	return reportPath
}

/**
 * Analysis function for dependencies
 */
function checkDependencies(options, utils) {
	const { log, heading } = utils

	heading("Analyzing dependencies")
	log("🔍 Dependency Analyzer (Plutonium Development Preview)")
	log(`Running on Node.js ${process.version} | ${process.platform}-${process.arch} | ${new Date().toISOString()}`)

	// Variables to hold dependency data
	let mainPkg = {}
	let webviewPkg = {}
	let mainPackages = []
	let webviewPackages = []
	let mainDeps = {}
	let webviewDeps = {}
	let sharedPackages = []
	let npmInconsistencies = []
	let pythonPackages = []
	let unpinnedPythonDeps = []
	let crossLanguageIssues = []

	// Check for JS dependencies
	if (fs.existsSync(MAIN_PACKAGE_JSON)) {
		// Read package.json files
		mainPkg = JSON.parse(fs.readFileSync(MAIN_PACKAGE_JSON, "utf8"))

		if (fs.existsSync(WEBVIEW_PACKAGE_JSON)) {
			webviewPkg = JSON.parse(fs.readFileSync(WEBVIEW_PACKAGE_JSON, "utf8"))
		} else {
			log("Webview package.json not found, skipping webview dependency analysis.", "warning")
		}

		// Extract npm dependencies
		mainDeps = {
			...(mainPkg.dependencies || {}),
			...(mainPkg.devDependencies || {}),
		}

		mainPackages = Object.entries(mainDeps).map(([name, version]) => ({
			name,
			version,
			type: mainPkg.dependencies && name in mainPkg.dependencies ? "dependency" : "devDependency",
		}))

		// Process webview dependencies only if webviewPkg was loaded
		webviewDeps =
			webviewPkg.dependencies || webviewPkg.devDependencies
				? {
						...(webviewPkg.dependencies || {}),
						...(webviewPkg.devDependencies || {}),
					}
				: {}

		if (Object.keys(webviewDeps).length > 0) {
			webviewPackages = Object.entries(webviewDeps).map(([name, version]) => ({
				name,
				version,
				type: webviewPkg.dependencies && name in webviewPkg.dependencies ? "dependency" : "devDependency",
			}))
		}

		// Find shared dependencies
		sharedPackages = Object.keys(mainDeps).filter((dep) => dep in webviewDeps)

		// Check for version inconsistencies
		sharedPackages.forEach((pkg) => {
			const mainVersion = mainDeps[pkg]
			const webviewVersion = webviewDeps[pkg]

			if (mainVersion !== webviewVersion) {
				const recommended = getHigherVersion(mainVersion, webviewVersion)
				npmInconsistencies.push({
					name: pkg,
					mainVersion,
					webviewVersion,
					recommended,
				})
			}
		})
	} else {
		log("No package.json found in the project root.", "warning")
	}

	// Get Python dependencies
	if (fs.existsSync(PYTHON_REQUIREMENTS)) {
		const reqData = parsePythonRequirements(PYTHON_REQUIREMENTS)
		pythonPackages = reqData.packages
		unpinnedPythonDeps = reqData.unpinned

		log(`Found ${pythonPackages.length} Python packages in requirements.txt`)
	} else {
		log("No Python requirements.txt found.", "warning")
	}

	log("\nAnalyzing dependencies...")
	log(`Found ${pythonPackages.length} Python packages`)
	log(`Found ${mainPackages.length} main npm packages`)
	log(`Found ${webviewPackages.length} webview npm packages`)

	heading("Checking npm dependency consistency")
	log(`Found ${sharedPackages.length} shared npm packages between main and webview`)

	if (npmInconsistencies.length > 0) {
		log("\n⚠️ Version inconsistencies found between npm environments:", "warning")
		npmInconsistencies.forEach((item) => {
			log(`  - ${item.name}: main(${item.mainVersion}) vs webview(${item.webviewVersion})`, "warning")
		})
	} else if (sharedPackages.length > 0) {
		log("✅ All shared npm packages have consistent versions", "success")
	}

	heading("Checking cross-language dependencies")

	// Check for cross-language conflicts
	if (pythonPackages.length > 0 && Object.keys(mainDeps).length > 0) {
		// Common packages that exist in both ecosystems
		const crossLanguageMapping = {
			openai: "openai",
			anthropic: "@anthropic-ai/sdk",
			"google-genai": "@google/generative-ai",
			"azure-openai": "@azure/openai",
			tiktoken: "tiktoken",
			ollama: "ollama",
		}

		pythonPackages.forEach((pkg) => {
			if (crossLanguageMapping[pkg.name] && mainDeps[crossLanguageMapping[pkg.name]]) {
				crossLanguageIssues.push({
					name: pkg.name,
					pythonVersion: `${pkg.name}@${pkg.version || "unpinned"}`,
					jsVersion: `${crossLanguageMapping[pkg.name]}@${mainDeps[crossLanguageMapping[pkg.name]]}`,
				})
			}
		})
	}

	if (crossLanguageIssues.length > 0) {
		log("\n⚠️ Potential cross-language dependency conflicts:", "warning")
		crossLanguageIssues.forEach((item) => {
			log(`  - Python: ${item.pythonVersion} / npm(main): ${item.jsVersion}`, "warning")
		})
		log("\n   ⓘ Review these packages to ensure version compatibility between languages")
	} else {
		log("✅ No cross-language dependency conflicts found", "success")
	}

	heading("Checking for unpinned Python dependencies")

	if (unpinnedPythonDeps.length > 0) {
		log("\n⚠️ Found unpinned Python dependencies:", "warning")
		unpinnedPythonDeps.forEach((dep) => log(`  - ${dep}`, "warning"))
	} else if (pythonPackages.length > 0) {
		log("✅ All Python dependencies are properly pinned!", "success")
	}

	// Build report data
	const reportData = {
		pythonPackages,
		mainPackages,
		webviewPackages,
		sharedPackages: sharedPackages.map((name) => ({ name })),
		npmInconsistencies,
		crossLanguageIssues,
		unpinnedPythonDeps,
	}

	// Generate HTML report
	const reportPath = generateHtmlReport(reportData)
	log(`\nReport generated: ${reportPath}`)

	// Print analysis summary
	heading("Analysis Summary")
	log(`${npmInconsistencies.length} npm version inconsistencies`)
	log(`${crossLanguageIssues.length} potential cross-language issues`)
	log(`${unpinnedPythonDeps.length} unpinned Python dependencies`)

	log(`\nTo view the full report: xdg-open ${reportPath}`)

	return {
		reportPath,
		summary: {
			npmInconsistencies: npmInconsistencies.length,
			crossLanguageIssues: crossLanguageIssues.length,
			unpinnedPythonDeps: unpinnedPythonDeps.length,
		},
	}
}

// This dual-module pattern handles both CommonJS and ES Module exports
// For CommonJS (used by .cjs files or older Node.js versions)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		checkDependencies,
		parseVersion,
		getHigherVersion,
	}
}

// For ES Modules (used by .js/.mjs files with type=module)
if (typeof exports !== "undefined") {
	exports.checkDependencies = checkDependencies
	exports.parseVersion = parseVersion
	exports.getHigherVersion = getHigherVersion
}
