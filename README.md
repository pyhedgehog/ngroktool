# ngroktool
This is both usable API and CLI to gather information from ngrok client or server account.

CLI is described in this document. API should be described someday (help will be gratefully accepted).

## Introduction

To work with ngrok client API we need no configuration, but if you want
to get information about tunnels started under your account on some other
(inaccessable directly) computer, you must provide login information
which will be stored in configuration file `ngroktool.yml` nearby `ngrok.yml`.

## Features

 1. Get information from local instance of `ngrok`.
 2. Get information from dashboard.ngrok.com site.
 3. Store several accounts of dashboard.ngrok.com site.
 4. Switch `accesstoken` of ngrok between saved accounts.
 5. Specify path to configuration files `ngrok.yml` and `ngroktoo.yml`.
 6. Search tunnel by protocol, name, local address and/or port.
 7. Create new tunnel in local instance of `ngrok`.
 8. All features available both via CLI tool and API functions.

## Tutorial

### Installation

```Console
git clone https://github.com/pyhedgehog/ngroktool.git
```

### Configuration

First you will need to add login information to config file. There are choices:

 1. If you are using it with `ngrok` started on the same computer you could skip this section.
 2. If you have created account on https://dashboard.ngrok.com/ itself, you should do:

```Console
node ngroktool.js -a yourauthname auth ngrokuser ngrokpass
```

 3. If you are using "Login with Github", you should do:

```Console
node ngroktool.js -a yourauthname auth -g githubuser githubpass
```

 4. If you are using "Sign in with Google", you should wait until it will be implemented or prepare pull request, sorry.

Global option `-a yourauthname` is essential - it must be used with all other commands to indicate what account you want to use.
If you want to use local `ngrok` omit it.

When you have several accounts, you can switch between them, using:

```Console
node ngroktool.js -a yourauthname switch
```

### Display

Display program-parsable (JSON) info for tunnels as it's returned from ngrok (format differs for local and remote operations):
```Console
node ngrok.js -a yourauthname dump -r
```

Display program-parsable (JSON) info for tunnels with unified field names:
```Console
node ngrok.js -a yourauthname dump
```

Display human-readable list of tunnels with information by columns:
```Console
node ngrok.js -a yourauthname list
```

Note: Remote operations can't get same ammount of information as remote - you can't retrieve local address, local port and tunnel name.

### Filtering

There are three subcommands to retrieve information on specific tunnel: `tcp`, `http`, `https`.
You can select tunnels by type (name of command), tunnel name, local port and/or local host name.
However limitations on remote tunnels mentioned in [[#Display]] section also applies to these commands too.

There are several usages of this functionality.

### API usage

You can also use `ngroktool` as a library:

```JavaScript
var ngroktool = require('ngroktool');
ngroktool.setconfigpath(pathtoconfig);
ngrokcfg.setauth({name:'yourauthname', login:'yourgithubname', password:'yourgithubpassword', type:'github'});
ngrokcfg.setauth({name:'otherauthname', login:'yourname', password:'yourpassword', type:'ngrok'});
ngroktool.login('yourauthname');
ngroktool.findtunnels({proto:'tcp', port:'22', name:'ssh', host:'127.0.0.1'}, function(foundtunnels, alltunnels){console.log(foundtunnels);});
ngroktool.login(null);
ngroktool.addtunnel({proto:'tcp', addr:'22', name:'ssh'});
ngroktool.addtunnel({proto:'tcp', addr:'other:22', name:'otherssh'});
```

#### OpenSSH via ngrok proxy

You can use it directly in `ssh_config` (assuming you are using cygwin, installed `socat` and path to your copy of ngroktool is `c:\ngroktool`):

```ssh_config
Host home-ngrok
	ProxyCommand socat - socks4a:127.0.0.1:`cd /cygdrive/c/ngroktool;node ngroktool.js -a yourauthname tcp`,socksport=9050
```

After that `ssh home-ngrok` will connect you to computer running `ngrok tcp 22` under specified account.

### Modification
You can add new tunnel to running instance of `ngrok` using it's API. This command only available on same computer as `ngrok` (i.e. you can't pass `-a` option here).

Forward local ssh:
```Console
node ngroktool.js add tcp 22
```

Forward web-server on computer `testserver`:
```Console
node ngroktool.js add http testserver:80
```

Forward web-server on computer `testserver` and replace tunnel ever if it's already exists (uses new ngrok subdomain):
```Console
node ngroktool.js add -f http testserver:80
```

## Usage reference

```Console
# node ngroktool.js -h
usage: ngroktool.js [-h] [-v] [-c CONFIG] [-a AUTH]
                    {auth,switch,tcp,http,https,add,list,help,dump} ...

Get info about tunnels from either stored account of ngrok.com or from 
locally started ngrok.

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  -c CONFIG, --config CONFIG
                        Path to config file (defaults to ~/.ngrok2/ngroktool.
                        yml)
  -a AUTH, --auth AUTH  Auth synonym to use

subcommands:
  {auth,switch,tcp,http,https,add,list,help,dump}

ngroktool.js help - show help for all subcommands

# node ngroktool.js help|grep usage:
usage: ngroktool.js [-h] [-v] [-c CONFIG] [-a AUTH]
usage: ngroktool.js auth [-h] [-g] [user] [password]
usage: ngroktool.js switch [-h]
usage: ngroktool.js tcp [-h] [-n NAME] [-H HOST] [port]
usage: ngroktool.js http [-h] [-n NAME] [-H HOST] [port]
usage: ngroktool.js https [-h] [-n NAME] [-H HOST] [port]
usage: ngroktool.js add [-h] [-n NAME] [-d SUBDOMAIN] [-H HOSTNAME] [-r] [-f]
usage: ngroktool.js list [-h]
usage: ngroktool.js dump [-h] [-r]
```

### Authentication commands

#### `auth` subcommand
Adds new authorization synonym to config file.

```Console
usage: ngroktool.js auth [-h] [-g] [user] [password]

Add or modify saved account info

Positional arguments:
  user          User
  password      Password

Optional arguments:
  -h, --help    Show this help message and exit.
  -g, --github  Login with GitHub user
```

#### `switch` subcommand
Will select authorization synonym as current for ngrok client (i.e. change `authtoken`).

```Console
# node ngroktool.js switch -h
usage: ngroktool.js switch [-h]

Switch ngrok to authtoken for selected account

Optional arguments:
  -h, --help  Show this help message and exit.
```

### Display commands

#### `list` subcommand

```Console
# node ngroktool.js list -h
usage: ngroktool.js list [-h]

Lists all tunnels in columns format

Optional arguments:
  -h, --help  Show this help message and exit.
```

#### `dump` subcommand

```Console
# node ngroktool.js dump -h
usage: ngroktool.js dump [-h] [-r]

Dump all tunnels in JSON format

Optional arguments:
  -h, --help  Show this help message and exit.
  -r, --raw   Dump all info
```

### Filter (search) commmands

#### `tcp`/`http`/`https` subcommands
```Console
# node ngroktool.js tcp -h
usage: ngroktool.js tcp [-h] [-n NAME] [-H HOST] [port]

Search for tcp tunnels

Positional arguments:
  port                  Private port to search (first found if not specified)

Optional arguments:
  -h, --help            Show this help message and exit.
  -n NAME, --name NAME  Connection name to search
  -H HOST, --host HOST, --hostname HOST
                        Private host to search (usually 127.0.0.1)
```

## API reference

TBD: See [API usage](#API usage) section now.

## Links
* [Alternatives](http://john-sheehan.com/blog/a-survey-of-the-localhost-proxying-landscape)
* [GitHub WebHooks Usage](https://help.github.com/articles/about-webhooks/)
* [GitHub WebHooks API](https://developer.github.com/webhooks/)
* [Stripe WebHooks](https://stripe.com/docs/webhooks)
