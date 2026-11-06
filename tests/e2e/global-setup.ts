import { execSync } from 'node:child_process';

export default function setup() {
  execSync('npm run seed', { stdio: 'inherit' }); // known state for the flow tests
}
