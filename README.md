# Tools

## normalize-track-data

Aggregates and merges location and acceleration data from two separate files into one single csv file.

The location file is a csv file containing these columns:
- time (seconds)
- lat
- lon
- velocity (optional, m/s)

The acceleration file is a csv file containing these columns:
- time (seconds)
- accAbsolute (m/s^2)

How to invoke the command:

```
> node ./tools/normalize-track-data.js
Options:
      --help               Show help                                   [boolean]
      --version            Show version number                         [boolean]
  -l, --location-data                                        [string] [required]
  -a, --acceleration-data                                    [string] [required]
  -p, --processed-data                                                  [string]
```
