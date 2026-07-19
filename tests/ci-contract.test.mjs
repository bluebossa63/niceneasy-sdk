import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('CI always runs the coverage command consumed by SonarQube', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const sonar = await readFile(new URL('../sonar-project.properties', import.meta.url), 'utf8')

  assert.doesNotMatch(workflow, /paths-ignore:/)
  assert.match(workflow, /test-command:\s*["']npm run coverage["']/)
  assert.match(sonar, /^sonar\.typescript\.lcov\.reportPaths=coverage\/lcov\.info$/m)
})
