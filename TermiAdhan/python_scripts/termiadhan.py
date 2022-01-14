# !/usr/bin/python3
import json
from json.decoder import JSONDecodeError, JSONDecoder
import sys
import requests
import datetime
import argparse
import pytz
import os
import logging
from plyer import notification
from pathlib import Path
from systemd import journal
from crontab import CronTab


## Check do not disturb mode with Notifications
## Configuration UI
## Snap / Flat Pack / Manjaro

homeEnv = str(Path.home())
home = '%s/Mon-Adhan' % homeEnv
log = logging.getLogger("mon-adhan-log")

############################### Sotware Management #################### 

def getArgsAtIndex(index):
    try:
        sys.argv[index]
    except IndexError:
        return 'now'
    else:
        return sys.argv[index]

def setupCronJob():
    cron = CronTab()
    basic_command = "* * * * * export DISPLAY=:0; sh " + os.getcwd() + "/termidhan_runner.sh >> /tmp/termidhan.log 2>&1"
    job = cron.new(command=basic_command)
    job.minute.every(1)
    basic_iter = cron.find_command("termidhan_runner.sh")

    for item in basic_iter:
        if str(item).find("termidhan_runner"):
            log.debug("crontab job already exist")
            break
        else:
            job.enable()
            cron.write()
            log.debug("cronjob does not exist and added successfully.. please see \"crontab -l\" ")
            break


def setupLogging():
    log_ch = journal.JournalHandler()
    log_fmt = logging.Formatter("%(levelname)s %(message)s")
    log_ch.setFormatter(log_fmt)
    log.addHandler(log_ch)
    log.setLevel(logging.DEBUG)
    log.info("info")


def createDataFolderIfNecessary():
    isExist = os.path.exists(home)

    if not isExist:
        try:
            os.mkdir(home)
        except OSError as error:
            log.info("Creation of the directory %s failed" % home)
        else:
            log.info("Successfully created the directory %s " % home)
    else:
        log.info("no need to create data folder")

def createDefaultConfigFile():

    config_file='%s/config_file.json' % home

    isExist = os.path.exists(config_file)

    if not isExist:
        try:
            f = open(config_file, "w+")
            f.write("{\"city\": null , \"timezone\": null}")
            f.close()
        except (IOError, OSError) as e:
            log.error("Config file failed to be saved because %s", e)



setupLogging()
#setupCronJob()
parser = argparse.ArgumentParser()

def valid_date(s):
    try:
        return datetime.datetime.strptime(s, "%d-%m-%Y")
    except ValueError:
        msg = "not a valid date: {0!r}".format(s)
        raise argparse.ArgumentTypeError(msg)


parser.add_argument(
    "-s",
    "--date",
    help="The Start Date  need to be in format DD-MM-YYYY",
    required=False,
    type=valid_date
)

args = parser.parse_args()
dateSelected = args.date
createDataFolderIfNecessary()
createDefaultConfigFile()

############################### Main Program ###############################

def checkIfInternetIsReachable():
    timeout = 5
    try:
        requests.get("https://www.google.com", timeout=timeout)
        return 1
    except (requests.ConnectionError, requests.Timeout) as exception:
        return 0


def updateLatestNotificationTag(tag):
    notificationTagFile = "%s/notification_lock.txt" % home
    try:
        f = open(notificationTagFile, "w+")
        now = datetime.datetime.now()
        f.write(tag + "@" + now.strftime("%Y-%m-%d"))
        f.close()
    except (IOError, OSError) as e:
        log.error("Notification log file saving failed %s", e)


def getLatestTagFromCache():
    notificationTagFile = "%s/notification_lock.txt" % home
    try:
        f = open(notificationTagFile, "r")
        return f.read()
    except (IOError, OSError) as e:
        return None

def getLatestConfigFromCache():
    config_file = "%s/config_file.json" % home
    try:
        f = open(config_file, "r")
        d=json.load(f)
        return d
    except (IOError, OSError, JSONDecodeError) as e:
        print(e)
        return None

def getGeolocalisationMetadatas():
    url = 'https://ipinfo.io'
    headers = {'content-type': 'application/json', 'Accept-Charset': 'UTF-8'}
    r = requests.post(url, headers=headers)
    try:
        json = r.json()
        infos = dict()
        infos["city"] = json["city"]
        infos["timezone"] = json["timezone"]
        infos["ip"] = json["ip"]
        return infos
    except ValueError:
        return None


def processTimings(data, timezone, nextOnly):
    if data is not None:
        if nextOnly == 0:
            for k, v in data:
                if k not in ['Midnight', 'Sunrise', 'Imsak']:
                    print("{:<10} {:<15}".format(k, v))
                else:
                    continue
        else:
            if timezone is not None:
                now = datetime.datetime.now(pytz.timezone(timezone))
            else:
                now = datetime.datetime.now()
            nextPrayer = None
            for k, v in data:
                if k not in ['Midnight', 'Sunrise', 'Imsak']:
                    hourPrayer = int(v.split(':', 1)[0])
                    minutesPrayer = int(v.split(':', 1)[1])
                    prayerTime = now.replace(hour=hourPrayer, minute=minutesPrayer)
                    if prayerTime > now:
                        nextPrayer = k
                        break
                    else:
                        continue
            if nextPrayer is None:
                log.info("No remaining prayer for today")
                # sendNotifications("dans 10 min")
                minutes_diff = 12
                if minutes_diff > 11:
                    minutesWord = "minutes" if minutes_diff > 1 else "minute"
                    sendNotifications("dans {} {}. {} à {}".format(minutes_diff, minutesWord, k, v), k)
                    log.info("Prochaine Priere: {:<10} {:<15}".format(k, v))
            else:
                minutes_diff = (prayerTime - now).total_seconds() / 60.0
                if minutes_diff < 11:
                    minutesWord = "minutes" if minutes_diff > 1 else "minute"
                    sendNotifications("dans {} {}. {} à {}".format(minutes_diff, minutesWord, k, v), k)
                    log.info("Prochaine Priere: {:<10} {:<15}".format(k, v))

    else:
        print('Data is not valid')

def checkNextPrayer():
    if checkIfInternetIsReachable() == 1:
        arg = getArgsAtIndex(1)
        if arg == "now":
            if checkIfInternetIsReachable() == 1:
                now = datetime.datetime.now()
                checkPrayerFor(now, bool(1))
        elif dateSelected is not None:
            checkPrayerFor(dateSelected, bool(0))
        else:
            log.info("argument not valid")
    else:
        log.info("Oops it seems that your internet connection is down.Please try again later.")


def checkPrayerFor(date, nextOnly):
    infos = getGeolocalisationMetadatas()
    if date is not None and infos is not None:
        timezone = infos["timezone"]
        ip = infos["ip"]
        dateStr = date.strftime("%Y-%m-%d")
        response = requests.get(
        "http://www.islamicfinder.us/index.php/api/prayer_times?user_ip=" + '89.234.157.4' + "&time_format=0&date=" + dateStr + "&method=2&maghrib_rule=1&maghrib_value=5&method=2")
        timings = response.json()["results"].items()
        processTimings(timings, timezone, nextOnly)
    elif date is not None:
            log.info("Current date cannot be found.")
    elif infos is not None:
            log.info("Current city is not determined")

def sendNotifications(message, tag):
    latestNotificationSentData = getLatestTagFromCache()
    print(latestNotificationSentData)
    now = datetime.datetime.now().strftime("%Y-%m-%d")
    latestTag = latestNotificationSentData.split('@')[0]
    date = latestNotificationSentData.split('@')[0]

    if latestTag != tag or (latestTag == tag and date != now):
        notification.notify(
            title='Prochaine Priere',
            message=message,
            timeout=5)

        updateLatestNotificationTag(tag)


checkNextPrayer()

#sendNotifications("dans 10 min", "Ishwa")
