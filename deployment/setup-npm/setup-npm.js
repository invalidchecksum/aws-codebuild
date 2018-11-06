// Parse and support command line args
const commandLineArgs = require('command-line-args');
const AWS = require('aws-sdk');
const OS = require('os');

// See after Setup routine for CICD Framework inclusion
const optionDefinitions = [
    { name: 'region', alias: 'r', type: String, defaultValue: 'us-east-1' },
    { name: 'role-arn', alias: 'a', type: String },
    { name: 'npmrcdir', alias: 'd', type: String },
    { name: 'shownpmrc', type: String }
]
const options = commandLineArgs(optionDefinitions);

if (options.shownpmrc === null) {
    var fs = require('fs');
    fs.readFile(process.env.HOME + '/.npmrc', function (err, data) {
        if (err) {
            console.log(err);
        }
        else {
            console.log('NPMRC File: ', data.toString());
        }
    })
}
else {
    console.log('Running NPM setup routine');
    // Assume creds
    assumeRole(options['role-arn']).then(creds => {
        var ssm = new AWS.SSM({
            credentials: creds,
            region: options.region
        })

        var resp = ssm.getParameters({
            Names: ['/mitel/config/nexusConnectionString'],
            WithDecryption: true
        }).promise()
            .then(data => {
                // Store the values from the parameter store so we don't lose them below in the FS work
                var npmrcString = data.Parameters[0].Value.replace(/\\r\\n/g, OS.EOL);

                var npmrcDummyData = npmrcString;
                var npmrcdir = options.npmrcdir ? npmrcdir : process.env.HOME + '/.npmrc';
                console.log('Set npmrc dir to ', npmrcdir);
                console.log('Writing dummy npmrc data');
                var fs = require('fs');
                fs.writeFile(npmrcdir, npmrcDummyData, (err, data) => {
                    if (err) {
                        console.log('Error writing dummy npmrc', err);
                    }
                    else {
                        console.log('Wrote dummy npmrc');
                    }
                });
            })
            .catch(err => {
                console.log('Error getting parameters from parameter store ', err);
            });
    })
}



function login(username, password, email, registry, scope, requiresQuotes, npmrcDir) {
    return new Promise((resolve, reject) => {
        var npmLogin = require('npm-cli-login');
        npmLogin(username, password, email, registry, scope, requiresQuotes, npmrcDir);
    })
}

function assumeRole(roleArn) {
    return new Promise((resolve, reject) => {
        let sts = new AWS.STS();

        sts.assumeRole({
            RoleArn: roleArn,
            RoleSessionName: "cicd-framework"
        }).promise()
            .then(data => resolve(new AWS.Credentials(data.Credentials.AccessKeyId,
                data.Credentials.SecretAccessKey, data.Credentials.SessionToken)))
            .catch(err => reject(err));
    })
}