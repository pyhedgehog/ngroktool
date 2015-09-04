# ngroktool

## Usage
**NB:** Subcommands `auth` and `switch` not implemented yet. You have to configure `ngrok.yml` manually.

```Console
# node ngroktool.js -h
usage: ngroktool.js [-h] [-v] [-a AUTH] {auth,tcp,http,https,switch} ...

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  -a AUTH, --auth AUTH  Auth synonym to use

subcommands:
  {auth,tcp,http,https,switch}
```

### `tcp`/`http`/`https` subcommands
```Console
# node ngroktool.js tcp -h
usage: ngroktool.js tcp [-h] [port]

Positional arguments:
  port        Private port to search (first found if not specified)

Optional arguments:
  -h, --help  Show this help message and exit.
```

### `auth` subcommand
*Will add new authorization synonym to config file.*

### `switch` subcommand
*Will select authorization synonym as current for ngrok client (i.e. change `authtoken`).*

## Links
* [Alternatives](http://john-sheehan.com/blog/a-survey-of-the-localhost-proxying-landscape)
* [GitHub WebHooks Usage](https://help.github.com/articles/about-webhooks/)
* [GitHub WebHooks API](https://developer.github.com/webhooks/)
* [Stripe WebHooks](https://stripe.com/docs/webhooks)
