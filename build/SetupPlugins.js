const fs = require("fs")
const Octokit = require('@octokit/rest').Octokit
const { exec } = require("child_process")
const path = require("path")
let ENVIRONMENT = require('../Environment')
const simpleGit = require("simple-git")


const cloneTheRepo = async () => {
  return new Promise(cloneTheRepoPromise)
}

const cloneTheRepoPromise = async (resolve) => {
  const username = "Superalgos"

  for (const propertyName in global.env.PROJECT_PLUGIN_MAP) {
    let cloneDir = path.join(global.env.PATH_TO_PLUGINS, global.env.PROJECT_PLUGIN_MAP[propertyName].dir)
    let repoURL = 'https://github.com/' + username + '/' + global.env.PROJECT_PLUGIN_MAP[propertyName].repo

    if (fs.existsSync(cloneDir)) {
      console.log(' ')
      console.log('[INFO] Directory ' + cloneDir + ' already exists.')
      console.log('[INFO] No need to clone repo ' + repoURL)
      continue
    }

    console.log(' ')
    console.log('[INFO] Cloning plugin repo from ' + repoURL + ' into ' + cloneDir)

    exec('git clone ' + repoURL + ' ' + global.env.PROJECT_PLUGIN_MAP[propertyName].dir + ' --branch develop',
      {
        cwd: path.join(global.env.PATH_TO_PLUGINS)
      },
      async function (error) {
        if (error) {
          console.log('')
          console.log("[ERROR] There was an error cloning the plugin this repo. ");
          console.log('')
          console.log(error)
        } else {
          console.log('[INFO] Cloning repo ' + global.env.PROJECT_PLUGIN_MAP[propertyName].repo + ' succeed.')
          /*
          Final step is to set the remote to the main Superalgos account.
          */
          const options = {
            baseDir: cloneDir,
            binary: 'git',
            maxConcurrentProcesses: 6,
          }
          const git = simpleGit(options)

          await git.addRemote('upstream', `https://github.com/Superalgos/${global.env.PROJECT_PLUGIN_MAP[propertyName].repo}`)
            .then(() => {
              console.log('[INFO] Setup of repo ' + global.env.PROJECT_PLUGIN_MAP[propertyName].repo + ' succeed.')
              resolve()
            })
            .catch((err) => {
              console.log('[ERROR] Setup of repo ' + global.env.PROJECT_PLUGIN_MAP[propertyName].repo + ' failed. You will need to set the git remote manually. ')
              console.log('')
              console.log(err)
              resolve()             
            })
        }
      })
    }
}


const clonePluginRepos = async () => {
  /* 
  Here we will clone all the Plugins Repos if they do not exist.
  */
  await cloneTheRepo()
}

const run = async () => {
  let ENVIRONMENT_MODULE = ENVIRONMENT.newEnvironment()
  global.env = ENVIRONMENT_MODULE

  clonePluginRepos()

}

run()