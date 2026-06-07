/**
 * 将生成的扩展 ZIP 文件复制到 packages/artifacts/ 暂存目录，
 * 并将暂存目录的 package.json 版本号同步为根 package.json 的当前版本。
 *
 * 在 GitHub Actions 发布工作流中，release-it 完成版本号更新和 ZIP 构建后调用此脚本。
 */
import path from 'node:path'
import process from 'node:process'

import fs from 'fs-extra'

import { log, r } from './utils'

const ARTIFACTS = [
  'extension.zip',
  'extension-firefox.zip',
]

const STAGING_DIR = r('packages', 'artifacts')

async function main() {
  // 读取根 package.json 中由 release-it 更新后的版本号
  const rootPkg = await fs.readJSON(r('package.json'))
  const version: string = rootPkg.version
  if (!version) {
    console.error('Could not read version from root package.json')
    process.exit(1)
  }

  // 确保暂存目录存在
  await fs.ensureDir(STAGING_DIR)

  // 复制 ZIP 文件到暂存目录
  for (const file of ARTIFACTS) {
    const src = r(file)
    if (!await fs.pathExists(src)) {
      console.error(`Required artifact not found: ${src}`)
      process.exit(1)
    }
    const dest = path.join(STAGING_DIR, file)
    await fs.copy(src, dest, { overwrite: true })
    log('ARTIFACT', `staged ${file}`)
  }

  // 同步版本号到暂存目录的 package.json
  const stagingPkgPath = path.join(STAGING_DIR, 'package.json')
  const stagingPkg = await fs.readJSON(stagingPkgPath)
  stagingPkg.version = version
  await fs.writeJSON(stagingPkgPath, stagingPkg, { spaces: 2 })
  log('ARTIFACT', `version set to ${version}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
