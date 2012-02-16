#!/bin/sh
# based on example code from http://www.epilogue.org/~xef4/start-stop-example

set -e

cd `dirname $0`/..
DAEMON_DIR=$PWD

NAME=GeoNotes
[ "${RUNDIR}" = "" ] && export RUNDIR="/tmp"
PIDFILE=${RUNDIR}/$NAME.pid
DAEMON=${DAEMON_DIR}/scripts/run-node.sh
DAEMON_OPTS=./app.js

export PATH="${PATH:+$PATH:}/usr/sbin:/sbin"

case "$1" in
  start)
        echo -n "Starting daemon: "$NAME
        start-stop-daemon --quiet --start -b -d $DAEMON_DIR -m --pidfile $PIDFILE --exec $DAEMON -- $DAEMON_OPTS
        echo "."
        ;;
  stop)
        echo -n "Stopping daemon: "$NAME
        start-stop-daemon --quiet --stop --oknodo --pidfile $PIDFILE
        echo "."
        ;;
  restart)
        echo -n "Restarting daemon: "$NAME
		$0 stop > /dev/null
		$0 start > /dev/null
        echo "."
        ;;

  *)
        echo "Usage: "$1" {start|stop|restart}"
        exit 1
esac

exit 0