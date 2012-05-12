#!/bin/bash

# Quick and dirty tests for the web service

SERVER="http://localhost:8000"
FAILS=0

# expect sets these variables related to the query
LOCATION=""
function expect {
	LOCATION=""
	code=$1
	shift 1
	cmd="$*"
	echo "Running " ${cmd}
	output=`${cmd} 2> /dev/null`
	if [ ! $? -eq 0 ]; then
		echo FAIL
		FAILS=$((1+${FAILS}))
		return 1
	fi
	c=`echo ${output} | grep HTTP | head -1 | cut -d ' ' -f 2`
	if [ ${c} != ${code} ]; then
		echo "FAIL (expected ${code} got ${c})"
		FAILS=$((1+${FAILS}))
		return 1
	fi
	LOCATION=`echo "${output}" | grep Location | head -1 | cut -d ' ' -f 2`
	echo "PASS"
	return 0
}

# start by deleting our test user, who may not exist
curl -D - -X DELETE -u tester:foobar ${SERVER}/geonotes/users/tester > /dev/null 2>&1

# user tests
expect 400 curl -D - -X POST -d 'username=tester&password=' ${SERVER}/geonotes/users/
expect 400 curl -D - -X POST -d 'username=tester' ${SERVER}/geonotes/users/
expect 400 curl -D - -X POST -d 'username' ${SERVER}/geonotes/users/
expect 201 curl -D - -X POST -d 'username=tester&password=foobar' ${SERVER}/geonotes/users/
expect 204 curl -D - -X GET -u tester:foobar ${SERVER}/geonotes/users/tester/
expect 403 curl -D - -X DELETE -u tester:foobaz ${SERVER}/geonotes/users/tester/
expect 204 curl -D - -X PUT -u tester:foobar -d 'username=tester&password=foobaz' ${SERVER}/geonotes/users/tester/
expect 403 curl -D - -X GET -u tester:foobar ${SERVER}/geonotes/users/tester/
expect 204 curl -D - -X GET -u tester:foobaz ${SERVER}/geonotes/users/tester/
expect 204 curl -D - -X DELETE -u tester:foobaz ${SERVER}/geonotes/users/tester/

# layer tests
expect 201 curl -D - -X POST -d 'username=tester&password=foobar' ${SERVER}/geonotes/users/
expect 403 curl -D - -X POST -u tester:foobaz -d 'layer=layer1' ${SERVER}/geonotes/users/tester/
expect 201 curl -D - -X POST -u tester:foobar -d 'layer=layer1' ${SERVER}/geonotes/users/tester/
expect 409 curl -D - -X POST -u tester:foobar -d 'layer=layer1' ${SERVER}/geonotes/users/tester/
expect 200 curl -D - -X GET -u tester:foobar ${SERVER}/geonotes/users/tester/
expect 200 curl -D - -X GET -u tester:foobar ${SERVER}/geonotes/users/tester/layer1/
expect 204 curl -D - -X DELETE -u tester:foobar ${SERVER}/geonotes/users/tester/layer1/
expect 404 curl -D - -X GET -u tester:foobar ${SERVER}/geonotes/users/tester/layer1/
expect 204 curl -D - -X DELETE -u tester:foobar ${SERVER}/geonotes/users/tester/

# geonote tests
expect 201 curl -D - -X POST -d 'username=tester&password=foobar' ${SERVER}/geonotes/users/
expect 201 curl -D - -X POST -u tester:foobar -d 'layer=layer1' ${SERVER}/geonotes/users/tester/
expect 201 curl -D - -X POST -u tester:foobar -d 'lat=37.7652&lon=-122.4301&note=Hmmm' ${SERVER}/geonotes/users/tester/layer1/
expect 201 curl -D - -X POST -u tester:foobar -d 'lat=36.7652&lon=-123.4301&note=Yow' ${SERVER}/geonotes/users/tester/layer1/
U=${LOCATION}
expect 200 curl -D - -X GET -u tester:foobar ${U}
expect 204 curl -D - -X PUT -u tester:foobar ${U}
expect 204 curl -D - -X PUT -u tester:foobar -d 'lat=39.7652' ${U}
expect 204 curl -D - -X PUT -u tester:foobar -d 'lon=-125.4301' ${U}
expect 204 curl -D - -X PUT -u tester:foobar -d 'note=yawn' ${U}
expect 204 curl -D - -X DELETE -u tester:foobar ${U}
expect 404 curl -D - -X DELETE -u tester:foobar ${U}
expect 204 curl -D - -X DELETE -u tester:foobar ${SERVER}/geonotes/users/tester/

if [ ${FAILS} -eq 0 ]; then
	echo "ALL TESTS PASS"
else
	echo "SOME FAILURE"
fi
