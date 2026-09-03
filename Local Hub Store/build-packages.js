const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const output = path.join(__dirname, "localhub-apps");
const iconOutput = path.join(__dirname, "icons");

const definitions = [
  { folder: "Flappy", id: "flappy", name: "Flappy", version: "1.0.0", category: "Games", description: "A polished, fast-paced flying arcade game.", icon: "Flappy_Bird_icon.png" },
  { folder: "Keyboard Warrior PWA", id: "keyboard-warrior", name: "Keyboard Warrior", version: "1.4.2", category: "Games", description: "Put your typing speed and accuracy to the test.", icon: "KWIcon2.png" },
  { folder: "MediMap", id: "medimap", name: "MediMap", version: "1.4.0", category: "Tools", description: "Find medicines quickly by name, category, gondola, or shelf and manage pharmacy inventory.", icon: "MediFindLogo.png" },
  { folder: "Specter", id: "specter", name: "Specter", version: "1.0.0", category: "Lifestyle", description: "A private personal journal with a focused writing experience.", icon: "SpecterIcon.png" },
  { folder: "Squish", id: "squish", name: "Squish!", version: "1.1.2", category: "Games", description: "A cheerful random squish test with adorable characters.", icon: "SquishIcon.png" },
  { folder: "Sweldo", id: "sweldo", name: "Sweldo", version: "1.3.1", category: "Finance", description: "A Philippine salary calculator for take-home pay and deductions.", icon: "SLogo.png" }
];

const mime = ext => ({
  ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg"
}[ext.toLowerCase()] || "application/octet-stream");

function dataUrl(file) {
  return `data:${mime(path.extname(file))};base64,${fs.readFileSync(file).toString("base64")}`;
}

function inlineAssets(folder) {
  const directory = path.join(root, folder);
  let html = fs.readFileSync(path.join(directory, "index.html"), "utf8");
  const assets = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name !== "index.html" && !/\.(zip|localhub-app)$/i.test(entry.name))
    .sort((a, b) => b.name.length - a.name.length);

  for (const asset of assets) {
    const escaped = asset.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`([\"'\\(])(?:\\.{1,2}\\/)*${escaped}(#[^\"'\\)\\s]+)?([\"'\\)])`, "g");
    const value = dataUrl(path.join(directory, asset.name));
    html = html.replace(pattern, (_, open, fragment = "", close) => `${open}${value}${fragment}${close}`);
  }
  return html;
}

fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(iconOutput, { recursive: true });
const catalog = definitions.map(definition => {
  const html = inlineAssets(definition.folder);
  const icon = definition.icon ? dataUrl(path.join(root, definition.folder, definition.icon)) : "";
  const app = {
    packageId: definition.id,
    name: definition.name,
    version: definition.version,
    group: definition.category,
    html,
    icon,
    favorite: false
  };
  const payload = { format: "local-hub-app", version: 1, exportedAt: new Date().toISOString(), app };
  const fileName = `${definition.id}.localhub-app`;
  fs.writeFileSync(path.join(output, fileName), JSON.stringify(payload));
  let iconUrl = "";
  if (definition.icon) {
    const extension = path.extname(definition.icon).toLowerCase();
    const bundledIcon = `${definition.id}${extension}`;
    fs.copyFileSync(path.join(root, definition.folder, definition.icon), path.join(iconOutput, bundledIcon));
    iconUrl = `Local Hub Store/icons/${bundledIcon}?v=${encodeURIComponent(definition.version)}`;
  }
  return {
    id: definition.id,
    name: definition.name,
    developer: "Local Hub Studio",
    version: definition.version,
    category: definition.category,
    description: definition.description,
    icon: iconUrl,
    packageUrl: `Local Hub Store/localhub-apps/${fileName}?v=${encodeURIComponent(definition.version)}`,
    size: fs.statSync(path.join(output, fileName)).size
  };
});

fs.writeFileSync(path.join(__dirname, "catalog.json"), JSON.stringify(catalog, null, 2));
console.log(`Built ${catalog.length} Local Hub app packages.`);
