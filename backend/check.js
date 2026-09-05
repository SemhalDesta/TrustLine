const http = require('https');

const options = {
	method: 'POST',
	hostname: 'network-as-code.p-eu.apihub.nokia.io',
	port: null,
	path: '/passthrough/camara/v1/sim-swap/sim-swap/v0/check',
	headers: {
		'x-rapidapi-key': '72d6f71234msha04e59220703990p1b939fjsnac94f5f72b27',
		'x-rapidapi-host': 'network-as-code.nokia.rapidapi.com',
		'Content-Type': 'application/json'
	}
};

const req = http.request(options, function (res) {
	const chunks = [];

	res.on('data', function (chunk) {
		chunks.push(chunk);
	});

	res.on('end', function () {
		const body = Buffer.concat(chunks);
		console.log(body.toString());
	});
});

req.write(JSON.stringify({
  phoneNumber: '+99999991000',
  maxAge: 240
}));
req.end();