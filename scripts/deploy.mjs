import { spawnSync } from 'node:child_process'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', ...options })
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
  }
}

function runOrThrow(command, args) {
  const result = run(command, args)
  if (!result.ok) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(`Command failed: ${command} ${args.join(' ')}${details ? `\n${details}` : ''}`)
  }
  return result.stdout
}

function hasGhCli() {
  const r = run('gh', ['--version'])
  return r.ok
}

function warn(message) {
  process.stderr.write(`${message}\n`)
}

async function main() {
  const branch = runOrThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const dirty = runOrThrow('git', ['status', '--porcelain'])
  if (dirty) {
    warn('Working tree is not clean; deploy will use whatever is pushed to GitHub, not local changes.')
  }

  const upstream = run('git', ['rev-parse', '--abbrev-ref', '@{u}'])
  if (upstream.ok) {
    const counts = run('git', ['rev-list', '--left-right', '--count', '@{u}...HEAD'])
    if (counts.ok) {
      const [behindStr, aheadStr] = counts.stdout.split(/\s+/)
      const behind = Number(behindStr ?? 0)
      const ahead = Number(aheadStr ?? 0)
      if (ahead > 0) warn(`You have ${ahead} unpushed commit(s); push them first to deploy the latest code.`)
      if (behind > 0) warn(`Your branch is behind upstream by ${behind} commit(s); consider pulling first.`)
    }
  } else {
    warn('No upstream branch configured; make sure you push to GitHub before deploying.')
  }

  if (!hasGhCli()) {
    warn('GitHub CLI (gh) is not installed. Install it and authenticate, then run:')
    warn('  gh auth login')
    warn(`  gh workflow run deploy.yml --ref ${branch}`)
    process.exit(1)
  }

  const res = run('gh', ['workflow', 'run', 'deploy.yml', '--ref', branch], { stdio: 'inherit' })
  process.exit(res.status)
}

main().catch((e) => {
  warn(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
