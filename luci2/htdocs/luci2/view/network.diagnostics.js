L.ui.view.extend({
	title: L.tr('Diagnostics'),

	execute: function() {
		var self = this;
		var tools = [ ];

		$.when(
			L.network.runPing('?').then(function(rv) {
				if (rv.code != -1) tools.push(['runPing', L.tr('IPv4 Ping')]);
			}),
			L.network.runPing6('?').then(function(rv) {
				if (rv.code != -1) tools.push(['runPing6', L.tr('IPv6 Ping')]);
			}),
			L.network.runTraceroute('?').then(function(rv) {
				if (rv.code != -1) tools.push(['runTraceroute', L.tr('IPv4 Traceroute')]);
			}),
			L.network.runTraceroute6('?').then(function(rv) {
				if (rv.code != -1) tools.push(['runTraceroute6', L.tr('IPv6 Tracroute')]);
			}),
			L.network.runNslookup('?').then(function(rv) {
				if (rv.code != -1) tools.push(['runNslookup', L.tr('DNS Lookup')]);
			})
		).then(function() {
			tools.sort(function(a, b) {
				if (a[0] < b[0])
					return -1;
				else if (a[0] > b[0])
					return 1;
				else
					return 0;
			});

			for (var i = 0; i < tools.length; i++)
				$('#tool').append($('<option />').attr('value', tools[i][0]).text(tools[i][1]));

			$('#tool').val('runPing');

			$('#run').click(function() {
				L.ui.loading(true);
				L.network[$('#tool').val()]($('#host').val()).then(function(rv) {
					$('#output').empty().show();

					if (rv.stdout)
						$('#output').text(rv.stdout);

					if (rv.stderr)
						$('#output').append($('<span />').css('color', 'red').text(rv.stderr));

					L.ui.loading(false);
				});
			});
		});
	}
});
