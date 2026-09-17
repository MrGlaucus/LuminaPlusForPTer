/**
 * 从 Simple Icons 拉取厂商官方图形,注入品牌色后写入 public/assets/vendors/。
 * 新增厂商(在 src/utils/vendors.ts 配好 logoFile + color)后重新运行即可。
 *
 * 用法:node scripts/fetch-vendor-logos.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorsSource = await readFile(path.join(root, "src/utils/vendors.ts"), "utf8");
const outputDir = path.join(root, "public/assets/vendors");

const SOURCES = [
  (slug) => `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`,
  (slug) => `https://unpkg.com/simple-icons@latest/icons/${slug}.svg`,
];

const vendors = [];
const idMatches = [...vendorsSource.matchAll(/id: "([^"]+)"/g)];
idMatches.forEach((match, index) => {
  const end = index + 1 < idMatches.length ? idMatches[index + 1].index : vendorsSource.length;
  const chunk = vendorsSource.slice(match.index, end);
  const logoFile = /logoFile: "([^"]+)"/.exec(chunk)?.[1];
  const color = /color: "([^"]+)"/.exec(chunk)?.[1];
  if (logoFile && color) vendors.push({ id: match[1], logoFile, color });
});

if (vendors.length === 0) {
  console.error("未能从 vendors.ts 提取厂商定义,请检查提取正则。");
  process.exit(1);
}
console.log(`发现 ${idMatches.length} 个厂商定义,其中 ${vendors.length} 个需要官方图形。`);

async function fetchIcon(slug, color) {
  for (const buildUrl of SOURCES) {
    const url = buildUrl(slug);
    try {
      const response = await fetch(url, { headers: { "User-Agent": "luminaplus-vendor-logos" } });
      if (!response.ok) continue;
      let svg = (await response.text()).trim();
      if (!svg.startsWith("<svg")) continue;
      // Simple Icons 的 path 默认无 fill(渲染为黑色),把品牌色注入到 <svg> 根元素上继承。
      if (!/<svg[^>]*\sfill=/.test(svg)) {
        svg = svg.replace(/<svg\b/, `<svg fill="${color}"`);
      }
      return svg;
    } catch {
      // 换下一个源。
    }
  }
  return null;
}

await mkdir(outputDir, { recursive: true });
const failed = [];
for (const vendor of vendors) {
  const slug = vendor.logoFile.replace(/\.svg$/, "");
  const svg = await fetchIcon(slug, vendor.color);
  if (!svg) {
    failed.push(`${vendor.id} (${slug})`);
    continue;
  }
  await writeFile(path.join(outputDir, vendor.logoFile), `${svg}\n`, "utf8");
  console.log(`ok   ${vendor.logoFile}`);
}

if (failed.length > 0) {
  console.log("\n未找到官方图形(需从 vendors.ts 移除 logoFile,改走字母徽标):");
  for (const item of failed) console.log(` - ${item}`);
} else {
  console.log(`\n全部 ${vendors.length} 个图形已就绪`);
}
