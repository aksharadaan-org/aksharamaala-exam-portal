import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git',args,{encoding:'utf8'}).trim();
if (git('branch','--show-current') !== 'main' || git('status','--porcelain')) {
  throw Error('Use a clean main checkout for sync. On a feature branch integrate origin/main first, then run npm run db:refresh.');
}
if (!git('remote').split('\n').includes('origin')) throw Error('This checkout has no origin. For an extracted starter, use npm run db:refresh. Configure the team repository before syncing.');
const previous = git('rev-parse','HEAD');
git('fetch','origin','main');
git('merge','--ff-only','FETCH_HEAD');
if (git('diff','--name-only',previous,'HEAD','--','package-lock.json')) {
  execFileSync('npm',['ci'],{stdio:'inherit'});
}
execFileSync('docker',['compose','up','-d','--wait','db'],{stdio:'inherit'});
execFileSync(process.execPath,['db/refresh.mjs'],{stdio:'inherit'});
