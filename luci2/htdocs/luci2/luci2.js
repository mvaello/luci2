/*
	LuCI2 - OpenWrt Web Interface

	Copyright 2013 Jo-Philipp Wich <jow@openwrt.org>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0
*/

String.prototype.format = function()
{
	var html_esc = [/&/g, '&#38;', /"/g, '&#34;', /'/g, '&#39;', /</g, '&#60;', />/g, '&#62;'];
	var quot_esc = [/"/g, '&#34;', /'/g, '&#39;'];

	function esc(s, r) {
		for( var i = 0; i < r.length; i += 2 )
			s = s.replace(r[i], r[i+1]);
		return s;
	}

	var str = this;
	var out = '';
	var re = /^(([^%]*)%('.|0|\x20)?(-)?(\d+)?(\.\d+)?(%|b|c|d|u|f|o|s|x|X|q|h|j|t|m))/;
	var a = b = [], numSubstitutions = 0, numMatches = 0;

	while ((a = re.exec(str)) != null)
	{
		var m = a[1];
		var leftpart = a[2], pPad = a[3], pJustify = a[4], pMinLength = a[5];
		var pPrecision = a[6], pType = a[7];

		numMatches++;

		if (pType == '%')
		{
			subst = '%';
		}
		else
		{
			if (numSubstitutions < arguments.length)
			{
				var param = arguments[numSubstitutions++];

				var pad = '';
				if (pPad && pPad.substr(0,1) == "'")
					pad = leftpart.substr(1,1);
				else if (pPad)
					pad = pPad;

				var justifyRight = true;
				if (pJustify && pJustify === "-")
					justifyRight = false;

				var minLength = -1;
				if (pMinLength)
					minLength = parseInt(pMinLength);

				var precision = -1;
				if (pPrecision && pType == 'f')
					precision = parseInt(pPrecision.substring(1));

				var subst = param;

				switch(pType)
				{
					case 'b':
						subst = (parseInt(param) || 0).toString(2);
						break;

					case 'c':
						subst = String.fromCharCode(parseInt(param) || 0);
						break;

					case 'd':
						subst = (parseInt(param) || 0);
						break;

					case 'u':
						subst = Math.abs(parseInt(param) || 0);
						break;

					case 'f':
						subst = (precision > -1)
							? ((parseFloat(param) || 0.0)).toFixed(precision)
							: (parseFloat(param) || 0.0);
						break;

					case 'o':
						subst = (parseInt(param) || 0).toString(8);
						break;

					case 's':
						subst = param;
						break;

					case 'x':
						subst = ('' + (parseInt(param) || 0).toString(16)).toLowerCase();
						break;

					case 'X':
						subst = ('' + (parseInt(param) || 0).toString(16)).toUpperCase();
						break;

					case 'h':
						subst = esc(param, html_esc);
						break;

					case 'q':
						subst = esc(param, quot_esc);
						break;

					case 'j':
						subst = String.serialize(param);
						break;

					case 't':
						var td = 0;
						var th = 0;
						var tm = 0;
						var ts = (param || 0);

						if (ts > 60) {
							tm = Math.floor(ts / 60);
							ts = (ts % 60);
						}

						if (tm > 60) {
							th = Math.floor(tm / 60);
							tm = (tm % 60);
						}

						if (th > 24) {
							td = Math.floor(th / 24);
							th = (th % 24);
						}

						subst = (td > 0)
							? '%dd %dh %dm %ds'.format(td, th, tm, ts)
							: '%dh %dm %ds'.format(th, tm, ts);

						break;

					case 'm':
						var mf = pMinLength ? parseInt(pMinLength) : 1000;
						var pr = pPrecision ? Math.floor(10*parseFloat('0'+pPrecision)) : 2;

						var i = 0;
						var val = parseFloat(param || 0);
						var units = [ '', 'K', 'M', 'G', 'T', 'P', 'E' ];

						for (i = 0; (i < units.length) && (val > mf); i++)
							val /= mf;

						subst = val.toFixed(pr) + ' ' + units[i];
						break;
				}

				subst = (typeof(subst) == 'undefined') ? '' : subst.toString();

				if (minLength > 0 && pad.length > 0)
					for (var i = 0; i < (minLength - subst.length); i++)
						subst = justifyRight ? (pad + subst) : (subst + pad);
			}
		}

		out += leftpart + subst;
		str = str.substr(m.length);
	}

	return out + str;
}

function LuCI2()
{
	var _luci2 = this;

	var alphacmp = function(a, b)
	{
		if (a < b)
			return -1;
		else if (a > b)
			return 1;
		else
			return 0;
	};

	var retcb = function(cb, rv)
	{
		if (typeof(cb) == 'function')
			cb(rv);

		return rv;
	};

	var isa = function(x, t)
	{
		if (typeof(x) != 'string' && typeof(t) == 'string')
			return (Object.prototype.toString.call(x) == '[object ' + t + ']');

		return (Object.prototype.toString.call(x) == Object.prototype.toString.call(t));
	};

	var rcall = function(obj, func, params, res_attr, res_default, cb, filter)
	{
		if (typeof(params) == 'undefined')
			params = { };

		return _luci2.rpc.call(obj, func, params).then(function(res) {
			if (res[0] != 0 || typeof(res[1]) == 'undefined')
				return retcb(cb, res_default);

			var rv = (typeof(res_attr) != 'undefined') ? res[1][res_attr] : res[1];
			if (typeof(rv) == 'undefined' || (typeof(res_default) != 'undefined' && !isa(rv, res_default)))
				return retcb(cb, res_default);

			if (typeof(filter) == 'function')
				rv = filter(rv);

			return retcb(cb, rv);
		});
	};

	var Class = function() { };

	Class.extend = function(properties)
	{
		Class.initializing = true;

		var prototype = new this();
		var superprot = this.prototype;

		Class.initializing = false;

		$.extend(prototype, properties, {
			callSuper: function() {
				var args = [ ];
				var meth = arguments[0];

				if (typeof(superprot[meth]) != 'function')
					return undefined;

				for (var i = 1; i < arguments.length; i++)
					args.push(arguments[i]);

				return superprot[meth].apply(this, args);
			}
		});

		function _class()
		{
			this.options = arguments[0] || { };

			if (!Class.initializing && typeof(this.init) == 'function')
				this.init.apply(this, arguments);
		}

		_class.prototype = prototype;
		_class.prototype.constructor = _class;

		_class.extend = arguments.callee;

		return _class;
	};

	this.defaults = function(obj, def)
	{
		for (var key in def)
			if (typeof(obj[key]) == 'undefined')
				obj[key] = def[key];

		return obj;
	};

	this.deferred = function(x)
	{
		return (typeof(x) == 'object' &&
		        typeof(x.then) == 'function' &&
		        typeof(x.promise) == 'function');
	};

	this.deferrable = function()
	{
		if (this.deferred(arguments[0]))
			return arguments[0];

		var d = $.Deferred();
		    d.resolve.apply(d, arguments);

		return d.promise();
	};

	this.i18n = {

		loaded: false,
		catalog: { },
		plural:  function(n) { return 0 + (n != 1) },

		init: function() {
			if (_luci2.i18n.loaded)
				return;

			var lang = (navigator.userLanguage || navigator.language || 'en').toLowerCase();
			var langs = (lang.indexOf('-') > -1) ? [ lang, lang.split(/-/)[0] ] : [ lang ];

			for (var i = 0; i < langs.length; i++)
				$.ajax('%s/i18n/base.%s.json'.format(_luci2.globals.resource, langs[i]), {
					async:    false,
					cache:    true,
					dataType: 'json',
					success:  function(data) {
						$.extend(_luci2.i18n.catalog, data);

						var pe = _luci2.i18n.catalog[''];
						if (pe)
						{
							delete _luci2.i18n.catalog[''];
							try {
								var pf = new Function('n', 'return 0 + (' + pe + ')');
								_luci2.i18n.plural = pf;
							} catch (e) { };
						}
					}
				});

			_luci2.i18n.loaded = true;
		}

	};

	this.tr = function(msgid)
	{
		_luci2.i18n.init();

		var msgstr = _luci2.i18n.catalog[msgid];

		if (typeof(msgstr) == 'undefined')
			return msgid;
		else if (typeof(msgstr) == 'string')
			return msgstr;
		else
			return msgstr[0];
	};

	this.trp = function(msgid, msgid_plural, count)
	{
		_luci2.i18n.init();

		var msgstr = _luci2.i18n.catalog[msgid];

		if (typeof(msgstr) == 'undefined')
			return (count == 1) ? msgid : msgid_plural;
		else if (typeof(msgstr) == 'string')
			return msgstr;
		else
			return msgstr[_luci2.i18n.plural(count)];
	};

	this.trc = function(msgctx, msgid)
	{
		_luci2.i18n.init();

		var msgstr = _luci2.i18n.catalog[msgid + '\u0004' + msgctx];

		if (typeof(msgstr) == 'undefined')
			return msgid;
		else if (typeof(msgstr) == 'string')
			return msgstr;
		else
			return msgstr[0];
	};

	this.trcp = function(msgctx, msgid, msgid_plural, count)
	{
		_luci2.i18n.init();

		var msgstr = _luci2.i18n.catalog[msgid + '\u0004' + msgctx];

		if (typeof(msgstr) == 'undefined')
			return (count == 1) ? msgid : msgid_plural;
		else if (typeof(msgstr) == 'string')
			return msgstr;
		else
			return msgstr[_luci2.i18n.plural(count)];
	};

	this.setHash = function(key, value)
	{
		var h = '';
		var data = this.getHash(undefined);

		if (typeof(value) == 'undefined')
			delete data[key];
		else
			data[key] = value;

		var keys = [ ];
		for (var k in data)
			keys.push(k);

		keys.sort();

		for (var i = 0; i < keys.length; i++)
		{
			if (i > 0)
				h += ',';

			h += keys[i] + ':' + data[keys[i]];
		}

		if (h)
			location.hash = '#' + h;
	};

	this.getHash = function(key)
	{
		var data = { };
		var tuples = (location.hash || '#').substring(1).split(/,/);

		for (var i = 0; i < tuples.length; i++)
		{
			var tuple = tuples[i].split(/:/);
			if (tuple.length == 2)
				data[tuple[0]] = tuple[1];
		}

		if (typeof(key) != 'undefined')
			return data[key];

		return data;
	};

	this.globals = {
		resource: '/luci2'
	};

	this.rpc = {

		_msg_id: 1,

		_wrap_msg: function(method, object, func, args)
		{
			if (typeof(args) != 'object')
				args = { };

			return {
				id:      _luci2.rpc._msg_id++,
				jsonrpc: "2.0",
				method:  method,
				params:  (method == 'call') ? [ _luci2.globals.sid, object, func, args ] : object
			};
		},

		_parse_response: function(keys, priv)
		{
			return function(data) {
				var obj;
				try {
					obj = $.parseJSON(data);
				} catch(e) { }

				if (typeof(obj) != 'object')
					return undefined;

				/* is a batched response */
				if (keys)
				{
					var rv = { };
					for (var i = 0; i < obj.length; i++)
					{
						var p = (typeof(priv) != 'undefined') ? priv[i] : undefined;

						if ($.isArray(obj[i].result) && typeof(priv) != 'undefined')
							obj[i].result[2] = p;

						if (obj[i].jsonrpc != '2.0' || obj[i].error || !obj[i].result)
							rv[keys[i]] = [ 4 /* UBUS_STATUS_NO_DATA */, undefined, p ];
						else
							rv[keys[i]] = obj[i].result;
					}
					return rv;
				}

				if (obj.jsonrpc != '2.0' || obj.error || !obj.result)
					return [ 4 /* UBUS_STATUS_NO_DATA */, undefined, priv ];

				if ($.isArray(obj.result) && typeof(priv) != 'undefined')
					obj.result[2] = priv;

				return obj.result;
			};
		},

		_post_msg: function(message, cb, keys, priv)
		{
			return $.ajax('/ubus', {
				cache:       false,
				contentType: 'application/json',
				data:        JSON.stringify(message),
				dataFilter:  _luci2.rpc._parse_response(keys, priv),
				dataType:    'text',
				success:     cb,
				type:        'POST'
			});
		},

		_post_single: function(object, method, args, cb, priv)
		{
			var msg = _luci2.rpc._wrap_msg('call', object, method, args, priv);
			return _luci2.rpc._post_msg(msg, cb, undefined, priv);
		},

		_post_batch: function(methods, cb)
		{
			if (typeof(methods) != 'object')
				return undefined;

			var msgs = [ ];
			var keys = [ ];
			var priv = [ ];

			for (var k in methods)
			{
				if (typeof(methods[k]) != 'object' || methods[k].length < 2)
					continue;

				keys.push(k);
				priv.push(methods[k][3]);
				msgs.push(_luci2.rpc._wrap_msg('call', methods[k][0], methods[k][1], methods[k][2]));
			}

			if (msgs.length > 0)
				return _luci2.rpc._post_msg(msgs, cb, keys, priv);

			return _luci2.deferrable([ ]);
		},

		call: function()
		{
			var a = arguments;
			if (typeof a[0] == 'string')
				return _luci2.rpc._post_single(a[0], a[1], a[2], a[3], a[4]);
			else
				return _luci2.rpc._post_batch(a[0], a[1]);
		},

		list: function(objects)
		{
			var msg = _luci2.rpc._wrap_msg('list', objects);
			return _luci2.rpc._post_msg(msg);
		},

		access: function(scope, object, method, cb)
		{
			return _luci2.rpc._post_single('session', 'access', {
				'sid':      _luci2.globals.sid,
				'scope':	scope,
				'object':   object,
				'function': method
			}, function(rv) {
				return retcb(cb, (rv[0] == 0 && rv[1] && rv[1].access == true));
			});
		}
	};

	this.uci = {

		writable: function(cb)
		{
			return _luci2.rpc.access('ubus', 'uci', 'commit', cb);
		},

		add: function(config, type, cb)
		{
			return rcall('uci', 'add', { config: config, type: type }, 'section', '', cb);
		},

		apply: function()
		{

		},

		changes: function(config)
		{
			return rcall('uci', 'changes', { config: config }, 'changes', [ ], cb);
		},

		commit: function(config)
		{
			return rcall('uci', 'commit', { config: config }, undefined, undefined, cb);
		},

		'delete': function(config, section, option)
		{
			var req = { config: config, section: section };

			if (isa(option, 'Array'))
				req.options = option;
			else
				req.option = option;

			return rcall('uci', 'delete', req, undefined, undefined, cb);
		},

		delete_all: function(config, type, matches)
		{
			return rcall('uci', 'delete', { config: config, type: type, match: matches }, undefined, undefined, cb);
		},

		foreach: function(config, type, cb)
		{
			return rcall('uci', 'get', { config: config, type: type }, 'values', { }, function(sections) {
				for (var s in sections)
					cb(sections[s]);
			});
		},

		get: function(config, section, option, cb)
		{
			return rcall('uci', 'get', { config: config, section: section, option: option }, undefined, { }, function(res) {
				if (typeof(option) == 'undefined')
					return retcb(cb, (res.values && res.values['.type']) ? res.values['.type'] : undefined);

				return retcb(cb, res.value);
			});
		},

		get_all: function(config, section, cb)
		{
			return rcall('uci', 'get', { config: config, section: section }, 'values', { }, cb);
		},

		get_first: function(config, type, option, cb)
		{
			return rcall('uci', 'get', { config: config, type: type }, 'values', { }, function(sections) {
				for (var s in sections)
				{
					var val = (typeof(option) == 'string') ? sections[s][option] : sections[s]['.name'];

					if (typeof(val) != 'undefined')
						return retcb(cb, val);
				}

				return retcb(cb, undefined);
			});
		},

		section: function(config, type, name, values, cb)
		{
			return rcall('uci', 'add', { config: config, type: type, name: name, values: values }, 'section', undefined, cb);
		},

		set: function(config, section, option, value, cb)
		{
			if (typeof(value) == 'undefined' && typeof(option) == 'string')
				return rcall('uci', 'add', { config: config, section: section, type: option }, undefined, undefined, cb);
			else if (isa(option, 'Object'))
				return rcall('uci', 'set', { config: config, section: section, values: option }, undefined, undefined, cb);
			else

			var values = { };
			    values[option] = value;

			return rcall('uci', 'set', { config: config, section: section, values: values }, undefined, undefined, cb);
		},

		order: function(config, sections, cb)
		{
			return rcall('uci', 'order', { config: config, sections: sections }, undefined, undefined, cb);
		}
	};

	this.network = {
		getNetworkStatus: function(cb)
		{
			var ifaces = [ ];
			var assign = function(target, key)
			{
				return function(value) {
					if (typeof(value) != 'undefined' && !$.isEmptyObject(value))
						target[key] = value;
				};
			};

			return _luci2.rpc.list().then(function(data) {
				var requests = [ ];

				for (var i = 0; i < data.length; i++)
				{
					if (data[i].indexOf('network.interface.') != 0)
						continue;

					var ifname = data[i].substring(18);
					if (ifname == 'loopback')
						continue;

					var iface = { 'name': ifname };

					ifaces.push(iface);
					requests.push(['network.interface', 'status', { 'interface': ifname }, iface]);
				}

				return _luci2.rpc.call(requests, function(responses) {
					for (var key in responses)
						if (responses[key][0] == 0 && responses[key][1] && responses[key][2])
							$.extend(responses[key][2], responses[key][1]);
				});
			}).then(function() {
				var requests = [ ];

				for (var i = 0; i < ifaces.length; i++)
				{
					var iface = ifaces[i];

					var dev = iface.l3_device || iface.l2_device;
					if (!dev)
						continue;

					iface.device = { 'name': dev };
					requests[dev] = ['network.device', 'status', { 'name': dev }, iface.device];
				}

				return _luci2.rpc.call(requests, function(responses) {
					for (var key in responses)
						if (responses[key][0] == 0 && responses[key][1] && responses[key][2])
							$.extend(responses[key][2], responses[key][1]);
				});
			}).then(function() {
				var requests = [ ];

				for (var i = 0; i < ifaces.length; i++)
				{
					var iface = ifaces[i];
					if (!iface.device)
						continue;

					var subdevs = iface.device['bridge-members'];
					if (!subdevs)
						continue;

					iface.subdevices = [ ];
					for (var j = 0; j < subdevs.length; j++)
					{
						iface.subdevices[j] = { 'name': subdevs[j] };
						requests.push(['network.device', 'status', { 'name': subdevs[j] }, iface.subdevices[j]]);
					}
				}

				return _luci2.rpc.call(requests, function(responses) {
					for (var key in responses)
						if (responses[key][0] == 0 && responses[key][1] && responses[key][2])
							$.extend(responses[key][2], responses[key][1]);
				});
			}).then(function() {
				var requests = [ ];

				for (var i = 0; i < ifaces.length; i++)
				{
					var iface = ifaces[i];

					if (iface.device)
						requests.push(['iwinfo', 'info', { 'device': iface.device.name }, iface.device]);

					if (iface.subdevices)
						for (var j = 0; j < iface.subdevices.length; j++)
							requests.push(['iwinfo', 'info', { 'device': iface.subdevices[j].name }, iface.subdevices[j]]);
				}

				return _luci2.rpc.call(requests, function(responses) {
					for (var key in responses)
						if (responses[key][0] == 0 && responses[key][1] && responses[key][2])
							if (!$.isEmptyObject(responses[key][1]))
								responses[key][2].wireless = responses[key][1];
				});
			}).then(function() {
				ifaces.sort(function(a, b) {
					if (a['interface'] < b['interface'])
						return -1;
					else if (a['interface'] > b['interface'])
						return 1;
					else
						return 0;
				});
				return retcb(cb, ifaces);
			});
		},

		findWanInterfaces: function(cb)
		{
			return _luci2.rpc.list().then(function(data) {
				var requests = { };
				for (var i = 0; i < data.length; i++)
				{
					if (data[i].indexOf('network.interface.') == 0)
					{
						var ifname = data[i].substring(18);
						requests[ifname] = ['network.interface', 'status', { 'interface': ifname }];
					}
				}
				return _luci2.rpc.call(requests);
			}).then(function(responses) {
				var rv = [ ];
				for (var ifname in responses)
				{
					var response = responses[ifname];

					if (response[0] != 0 || !response[1] || !response[1].route)
						continue;

					for (var rn = 0, rt = response[1].route[rn];
						 rn < response[1].route.length;
						 rn++, rt = response[1].route[rn])
					{
						if (typeof(rt.table) != 'undefined')
							continue;

						if (rt.target == '0.0.0.0' && rt.mask == 0)
							rv[0] = response[1];
						else if (rt.target == '::' && rt.mask == 0)
							rv[1] = response[1];
					}
				}

				return retcb(cb, rv);
			});
		},

		getDHCPLeases: function(cb)
		{
			return rcall('luci2.network', 'dhcp_leases', undefined, 'leases', [ ], cb);
		},

		getDHCPv6Leases: function(cb)
		{
			return rcall('luci2.network', 'dhcp6_leases', undefined, 'leases', [ ], cb);
		},

		getRoutes: function(cb)
		{
			return rcall('luci2.network', 'routes', undefined, 'routes', [ ], cb);
		},

		getIPv6Routes: function(cb)
		{
			return rcall('luci2.network', 'routes6', undefined, 'routes', [ ], cb);
		},

		getARPTable: function(cb)
		{
			return rcall('luci2.network', 'arp_table', undefined, 'entries', [ ], cb);
		},

		getInterfaceStatus: function(iface, cb)
		{
			return rcall('network.interface', 'status', { 'interface': iface }, undefined, { }, cb, function(rv) {
				rv['interface'] = iface;
				rv['l2_device'] = rv['device'];
				return rv;
			});
		},

		getDeviceStatus: function(dev, cb)
		{
			return rcall('network.device', 'status', { name: dev }, undefined, { }, cb, function(rv) {
				if (typeof(dev) == 'string')
					rv.device = dev;
				return rv;
			});
		},

		getConntrackCount: function(cb)
		{
			return rcall('luci2.network', 'conntrack_count', undefined, undefined, {
				count: 0,
				limit: 0
			}, cb);
		}
	};

	this.wireless = {
		getDevices: function(cb) {
			return rcall('iwinfo', 'devices', undefined, 'devices', [ ], cb, function(rv) {
				rv.sort();
				return rv;
			});
		},

		getInfo: function(dev, cb) {
			var parse_info = function(device, info, rv)
			{
				if (!rv[info.phy])
					rv[info.phy] = {
						networks: [ ]
					};

				var phy = rv[info.phy];

				var phy_attrs = [
					'country', 'channel', 'frequency', 'frequency_offset',
					'txpower', 'txpower_offset', 'hwmodes', 'hardware', 'phy'
				];

				var net_attrs = [
					'ssid', 'bssid', 'mode', 'quality', 'quality_max',
					'signal', 'noise', 'bitrate', 'encryption'
				];

				for (var i = 0; i < phy_attrs.length; i++)
					phy[phy_attrs[i]] = info[phy_attrs[i]];

				var net = {
					device: device
				};

				for (var i = 0; i < net_attrs.length; i++)
					net[net_attrs[i]] = info[net_attrs[i]];

				phy.networks.push(net);

				return phy;
			};

			if (!dev)
			{
				return _luci2.wireless.getDevices().then(function(devices) {
					var requests = [ ];

					for (var i = 0; i < devices.length; i++)
					{
						if (devices[i].indexOf('.sta') >= 0)
							continue;

						requests[devices[i]] = [ 'iwinfo', 'info', { device: devices[i] } ];
					}

					return _luci2.rpc.call(requests);
				}).then(function(responses) {
					var rv = { };

					for (var device in responses)
					{
						var response = responses[device];

						if (response[0] != 0 || !response[1])
							continue;

						parse_info(device, response[1], rv);
					}

					return retcb(cb, rv);
				});
			}

			return _luci2.rpc.call('iwinfo', 'info', { device: dev }).then(function(response) {
				if (response[0] != 0 || !response[1])
					return retcb(cb, { });

				return retcb(cb, parse_info(dev, response[1], { }));
			});
		},

		getAssocList: function(dev, cb)
		{
			if (!dev)
			{
				return _luci2.wireless.getDevices().then(function(devices) {
					var requests = { };

					for (var i = 0; i < devices.length; i++)
					{
						if (devices[i].indexOf('.sta') >= 0)
							continue;

						requests[devices[i]] = [ 'iwinfo', 'assoclist', { device: devices[i] } ];
					}

					return _luci2.rpc.call(requests);
				}).then(function(responses) {
					var rv = [ ];

					for (var device in responses)
					{
						var response = responses[device];

						if (response[0] != 0 || !response[1] || !response[1].results)
							continue;

						for (var i = 0; i < response[1].results.length; i++)
						{
							var station = response[1].results[i];

							station.device = device;
							rv.push(station);
						}
					}

					rv.sort(function(a, b) {
						return (a.device == b.device)
							? (a.bssid < b.bssid)
							: (a.device > b.device)
						;
					});

					return retcb(cb, rv);
				});
			}

			return _luci2.rpc.call('iwinfo', 'assoclist', { device: dev }).then(function(response) {
				var rv = [ ];

				if (response[0] != 0 || !response[1] || !response[1].results)
					return retcb(cb, rv);

				for (var i = 0; i < response[1].results.length; i++)
				{
					var station = response[1].results[i];

					station.device = dev;
					rv.push(station);
				}

				rv.sort(function(a, b) {
					return (a.bssid < b.bssid);
				});

				return retcb(cb, rv);
			});
		},

		formatEncryption: function(enc)
		{
			var format_list = function(l, s)
			{
				var rv = [ ];
				for (var i = 0; i < l.length; i++)
					rv.push(l[i].toUpperCase());
				return rv.join(s ? s : ', ');
			}

			if (!enc || !enc.enabled)
				return _luci2.tr('None');

			if (enc.wep)
			{
				if (enc.wep.length == 2)
					return _luci2.tr('WEP Open/Shared') + ' (%s)'.format(format_list(enc.ciphers, ', '));
				else if (enc.wep[0] == 'shared')
					return _luci2.tr('WEP Shared Auth') + ' (%s)'.format(format_list(enc.ciphers, ', '));
				else
					return _luci2.tr('WEP Open System') + ' (%s)'.format(format_list(enc.ciphers, ', '));
			}
			else if (enc.wpa)
			{
				if (enc.wpa.length == 2)
					return _luci2.tr('mixed WPA/WPA2') + ' %s (%s)'.format(
						format_list(enc.authentication, '/'),
						format_list(enc.ciphers, ', ')
					);
				else if (enc.wpa[0] == 2)
					return 'WPA2 %s (%s)'.format(
						format_list(enc.authentication, '/'),
						format_list(enc.ciphers, ', ')
					);
				else
					return 'WPA %s (%s)'.format(
						format_list(enc.authentication, '/'),
						format_list(enc.ciphers, ', ')
					);
			}

			return _luci2.tr('Unknown');
		}
	};

	this.system = {
		getInfo: function(cb)
		{
			return _luci2.rpc.call({
				info:  [ 'system', 'info',  { } ],
				board: [ 'system', 'board', { } ],
				disk:  [ 'luci2.system', 'diskfree', { } ]
			}).then(function(responses) {
				var rv = { };

				if (responses.info[0] == 0)
					$.extend(rv, responses.info[1]);

				if (responses.board[0] == 0)
					$.extend(rv, responses.board[1]);

				if (responses.disk[0] == 0)
					$.extend(rv, responses.disk[1]);

				return retcb(cb, rv);
			});
		},

		getProcessList: function(cb)
		{
			return rcall('luci2.system', 'process_list', undefined, 'processes', [ ], cb, function(rv) {
				rv.sort(function(a, b) { return a.pid - b.pid });
				return rv;
			});
		},

		getSystemLog: function(cb)
		{
			return rcall('luci2.system', 'syslog', undefined, 'log', '', cb);
		},

		getKernelLog: function(cb)
		{
			return rcall('luci2.system', 'dmesg', undefined, 'log', '', cb);
		},

		getZoneInfo: function(cb)
		{
			return $.getJSON(_luci2.globals.resource + '/zoneinfo.json', cb);
		},

		canSendSignal: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'process_signal', cb);
		},

		sendSignal: function(pid, sig, cb)
		{
			return _luci2.rpc.call('luci2.system', 'process_signal', { pid: pid, signal: sig }).then(function(response) {
				return retcb(cb, response[0] == 0);
			});
		},

		initList: function(cb)
		{
			return rcall('luci2.system', 'init_list', undefined, 'initscripts', [ ], cb, function(rv) {
				rv.sort(function(a, b) { return (a.start || 0) - (b.start || 0) });
				return rv;
			});
		},

		initEnabled: function(init, cb)
		{
			return this.initList(function(list) {
				for (var i = 0; i < list.length; i++)
					if (list[i].name == init)
						return retcb(cb, !!list[i].enabled);

				return retcb(cb, false);
			});
		},

		initRun: function(init, action, cb)
		{
			return _luci2.rpc.call('luci2.system', 'init_action', { name: init, action: action }).then(function(response) {
				return retcb(cb, response[0] == 0);
			});
		},

		canInitRun: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'init_action', cb);
		},

		initStart:   function(init, cb) { return _luci2.system.initRun(init, 'start',   cb) },
		initStop:    function(init, cb) { return _luci2.system.initRun(init, 'stop',    cb) },
		initRestart: function(init, cb) { return _luci2.system.initRun(init, 'restart', cb) },
		initReload:  function(init, cb) { return _luci2.system.initRun(init, 'reload',  cb) },
		initEnable:  function(init, cb) { return _luci2.system.initRun(init, 'enable',  cb) },
		initDisable: function(init, cb) { return _luci2.system.initRun(init, 'disable', cb) },


		getRcLocal: function(cb)
		{
			return rcall('luci2.system', 'rclocal_get', undefined, 'data', '', cb);
		},

		setRcLocal: function(data, cb)
		{
			return rcall('luci2.system', 'rclocal_set', { data: data }, undefined, undefined, cb);
		},

		canSetRcLocal: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'rclocal_set', cb);
		},


		getCrontab: function(cb)
		{
			return rcall('luci2.system', 'crontab_get', undefined, 'data', '', cb);
		},

		setCrontab: function(data, cb)
		{
			return rcall('luci2.system', 'crontab_set', { data: data }, undefined, undefined, cb);
		},

		canSetCrontab: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'crontab_set', cb);
		},


		getSSHKeys: function(cb)
		{
			return rcall('luci2.system', 'sshkeys_get', undefined, 'keys', [ ], cb);
		},

		setSSHKeys: function(keys, cb)
		{
			return rcall('luci2.system', 'sshkeys_set', { keys: keys }, undefined, undefined, cb);
		},

		canSetSSHKeys: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'sshkeys_set', cb);
		},


		setPassword: function(user, pass, cb)
		{
			return rcall('luci2.system', 'password_set', { user: user, password: pass }, undefined, undefined, cb);
		},

		canSetPassword: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'password_set', cb);
		},


		listLEDs: function(cb)
		{
			return rcall('luci2.system', 'led_list', undefined, 'leds', [ ], cb);
		},

		listUSBDevices: function(cb)
		{
			return rcall('luci2.system', 'usb_list', undefined, 'devices', [ ], cb);
		},


		testUpgrade: function(cb)
		{
			return rcall('luci2.system', 'upgrade_test', undefined, undefined, { }, cb);
		},

		startUpgrade: function(keep, cb)
		{
			return rcall('luci2.system', 'upgrade_start', { keep: !!keep }, undefined, undefined, cb);
		},

		cleanUpgrade: function(cb)
		{
			return rcall('luci2.system', 'upgrade_clean', undefined, undefined, undefined, cb);
		},

		canUpgrade: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'upgrade_start', cb);
		},


		restoreBackup: function(cb)
		{
			return rcall('luci2.system', 'backup_restore', undefined, undefined, undefined, cb);
		},

		cleanBackup: function(cb)
		{
			return rcall('luci2.system', 'backup_clean', undefined, undefined, undefined, cb);
		},

		canRestoreBackup: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'backup_restore', cb);
		},


		getBackupConfig: function(cb)
		{
			return rcall('luci2.system', 'backup_config_get', undefined, 'config', '', cb);
		},

		setBackupConfig: function(data, cb)
		{
			return rcall('luci2.system', 'backup_config_set', { data: data }, undefined, undefined, cb);
		},

		canSetBackupConfig: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'backup_config_set', cb);
		},


		listBackup: function(cb)
		{
			return rcall('luci2.system', 'backup_list', undefined, 'files', [ ], cb);
		},


		performReboot: function(cb)
		{
			return rcall('luci2.system', 'reboot', undefined, undefined, undefined, cb);
		},

		canPerformReboot: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.system', 'reboot', cb);
		}
	};

	this.opkg = {
		updateLists: function(cb)
		{
			return rcall('luci2.opkg', 'update', undefined, undefined, { }, cb);
		},

		_fetchPackages: function(action, offset, limit, pattern, cb)
		{
			var packages = [ ];
			var reqlimit = Math.min(limit, 100);

			if (reqlimit <= 0)
				reqlimit = 100;

			return _luci2.rpc.call('luci2.opkg', action, { offset: offset, limit: reqlimit, pattern: pattern }).then(function(response) {
				if (response[0] != 0 || !response[1] || !response[1].total)
					return retcb(cb, { length: 0, total: 0 });

				packages.push.apply(packages, response[1].packages);
				packages.total = response[1].total;

				if (limit <= 0)
					limit = response[1].total;

				if (packages.length >= limit)
					return retcb(cb, packages);

				var requests = [ ];
				for (var i = offset + packages.length; i < limit; i += 100)
					requests.push(['luci2.opkg', action, { offset: i, limit: (Math.min(i + 100, limit) % 100) || 100, pattern: pattern }]);

				return _luci2.rpc.call(requests);
			}).then(function(responses) {
				for (var key in responses)
				{
					var response = responses[key];

					if (response[0] != 0 || !response[1] || !response[1].packages)
						continue;

					packages.push.apply(packages, response[1].packages);
					packages.total = response[1].total;
				}

				return retcb(cb, packages);
			});
		},

		listPackages: function(offset, limit, pattern, cb)
		{
			return _luci2.opkg._fetchPackages('list', offset, limit, pattern, cb);
		},

		installedPackages: function(offset, limit, pattern, cb)
		{
			return _luci2.opkg._fetchPackages('list_installed', offset, limit, pattern, cb);
		},

		findPackages: function(offset, limit, pattern, cb)
		{
			return _luci2.opkg._fetchPackages('find', offset, limit, pattern, cb);
		},

		installPackage: function(name, cb)
		{
			return rcall('luci2.opkg', 'install', { 'package': name }, undefined, { }, cb);
		},

		removePackage: function(name, cb)
		{
			return rcall('luci2.opkg', 'remove', { 'package': name }, undefined, { }, cb);
		},

		getConfig: function(cb)
		{
			return rcall('luci2.opkg', 'config_get', undefined, 'config', '', cb);
		},

		setConfig: function(data, cb)
		{
			return rcall('luci2.opkg', 'config_set', { data: data }, undefined, undefined, cb);
		},

		canInstallPackage: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.opkg', 'install', cb);
		},

		canRemovePackage: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.opkg', 'remove', cb);
		},

		canSetConfig: function(cb)
		{
			return _luci2.rpc.access('ubus', 'luci2.opkg', 'config_set', cb);
		}
	};

	this.ui = {

		loading: function(enable)
		{
			var win = $(window);
			var body = $('body');
			var div = _luci2._modal || (
				_luci2._modal = $('<div />')
					.addClass('cbi-modal-loader')
					.append($('<div />').text(_luci2.tr('Loading data...')))
					.appendTo(body)
			);

			if (enable)
			{
				body.css('overflow', 'hidden');
				body.css('padding', 0);
				body.css('width', win.width());
				body.css('height', win.height());
				div.css('width', win.width());
				div.css('height', win.height());
				div.show();
			}
			else
			{
				div.hide();
				body.css('overflow', '');
				body.css('padding', '');
				body.css('width', '');
				body.css('height', '');
			}
		},

		dialog: function(title, content, options)
		{
			var win = $(window);
			var body = $('body');
			var div = _luci2._dialog || (
				_luci2._dialog = $('<div />')
					.addClass('cbi-modal-dialog')
					.append($('<div />')
						.append($('<div />')
							.addClass('cbi-modal-dialog-header'))
						.append($('<div />')
							.addClass('cbi-modal-dialog-body'))
						.append($('<div />')
							.addClass('cbi-modal-dialog-footer')
							.append($('<button />')
								.addClass('cbi-button')
								.text(_luci2.tr('Close'))
								.click(function() {
									$('body')
										.css('overflow', '')
										.css('padding', '')
										.css('width', '')
										.css('height', '');

									$(this).parent().parent().parent().hide();
								}))))
					.appendTo(body)
			);

			if (typeof(options) != 'object')
				options = { };

			if (title === false)
			{
				body
					.css('overflow', '')
					.css('padding', '')
					.css('width', '')
					.css('height', '');

				_luci2._dialog.hide();

				return;
			}

			var cnt = div.children().children('div.cbi-modal-dialog-body');
			var ftr = div.children().children('div.cbi-modal-dialog-footer');

			ftr.empty();

			if (options.style == 'confirm')
			{
				ftr.append($('<button />')
					.addClass('cbi-button')
					.text(_luci2.tr('Ok'))
					.click(options.confirm || function() { _luci2.ui.dialog(false) }));

				ftr.append($('<button />')
					.addClass('cbi-button')
					.text(_luci2.tr('Cancel'))
					.click(options.cancel || function() { _luci2.ui.dialog(false) }));
			}
			else if (options.style == 'close')
			{
				ftr.append($('<button />')
					.addClass('cbi-button')
					.text(_luci2.tr('Close'))
					.click(options.close || function() { _luci2.ui.dialog(false) }));
			}
			else if (options.style == 'wait')
			{
				ftr.append($('<button />')
					.addClass('cbi-button')
					.text(_luci2.tr('Close'))
					.attr('disabled', true));
			}

			div.find('div.cbi-modal-dialog-header').text(title);
			div.show();

			cnt
				.css('max-height', Math.floor(win.height() * 0.70) + 'px')
				.empty()
				.append(content);

			div.children()
				.css('margin-top', -Math.floor(div.children().height() / 2) + 'px');

			body.css('overflow', 'hidden');
			body.css('padding', 0);
			body.css('width', win.width());
			body.css('height', win.height());
			div.css('width', win.width());
			div.css('height', win.height());
		},

		upload: function(title, content, options)
		{
			var form = _luci2._upload || (
				_luci2._upload = $('<form />')
					.attr('method', 'post')
					.attr('action', '/cgi-bin/luci-upload')
					.attr('enctype', 'multipart/form-data')
					.attr('target', 'cbi-fileupload-frame')
					.append($('<p />'))
					.append($('<input />')
						.attr('type', 'hidden')
						.attr('name', 'sessionid')
						.attr('value', _luci2.globals.sid))
					.append($('<input />')
						.attr('type', 'hidden')
						.attr('name', 'filename')
						.attr('value', options.filename))
					.append($('<input />')
						.attr('type', 'file')
						.attr('name', 'filedata')
						.addClass('cbi-input-file'))
					.append($('<div />')
						.css('width', '100%')
						.addClass('progressbar')
						.addClass('intermediate')
						.append($('<div />')
							.css('width', '100%')))
					.append($('<iframe />')
						.attr('name', 'cbi-fileupload-frame')
						.css('width', '1px')
						.css('height', '1px')
						.css('visibility', 'hidden'))
			);

			var finish = _luci2._upload_finish_cb || (
				_luci2._upload_finish_cb = function(ev) {
					$(this).off('load');

					var body = (this.contentDocument || this.contentWindow.document).body;
					if (body.firstChild.tagName.toLowerCase() == 'pre')
						body = body.firstChild;

					var json;
					try {
						json = $.parseJSON(body.innerHTML);
					} catch(e) {
						json = {
							message: _luci2.tr('Invalid server response received'),
							error: [ -1, _luci2.tr('Invalid data') ]
						};
					};

					if (json.error)
					{
						L.ui.dialog(L.tr('File upload'), [
							$('<p />').text(_luci2.tr('The file upload failed with the server response below:')),
							$('<pre />').addClass('alert-message').text(json.message || json.error[1]),
							$('<p />').text(_luci2.tr('In case of network problems try uploading the file again.'))
						], { style: 'close' });
					}
					else if (typeof(ev.data.cb) == 'function')
					{
						ev.data.cb(json);
					}
				}
			);

			var confirm = _luci2._upload_confirm_cb || (
				_luci2._upload_confirm_cb = function() {
					var d = _luci2._upload;
					var f = d.find('.cbi-input-file');
					var b = d.find('.progressbar');
					var p = d.find('p');

					if (!f.val())
						return;

					d.find('iframe').on('load', { cb: options.success }, finish);
					d.submit();

					f.hide();
					b.show();
					p.text(_luci2.tr('File upload in progress …'));

					_luci2._dialog.find('button').prop('disabled', true);
				}
			);

			_luci2._upload.find('.progressbar').hide();
			_luci2._upload.find('.cbi-input-file').val('').show();
			_luci2._upload.find('p').text(content || _luci2.tr('Select the file to upload and press "%s" to proceed.').format(_luci2.tr('Ok')));

			_luci2.ui.dialog(title || _luci2.tr('File upload'), _luci2._upload, {
				style: 'confirm',
				confirm: confirm
			});
		},

		reconnect: function()
		{
			var protocols = (location.protocol == 'https:') ? [ 'http', 'https' ] : [ 'http' ];
			var ports     = (location.protocol == 'https:') ? [ 80, location.port || 443 ] : [ location.port || 80 ];
			var address   = location.hostname.match(/^[A-Fa-f0-9]*:[A-Fa-f0-9:]+$/) ? '[' + location.hostname + ']' : location.hostname;
			var images    = $();
			var interval, timeout;

			_luci2.ui.dialog(
				_luci2.tr('Waiting for device'), [
					$('<p />').text(_luci2.tr('Please stand by while the device is reconfiguring …')),
					$('<div />')
						.css('width', '100%')
						.addClass('progressbar')
						.addClass('intermediate')
						.append($('<div />')
							.css('width', '100%'))
				], { style: 'wait' }
			);

			for (var i = 0; i < protocols.length; i++)
				images = images.add($('<img />').attr('url', protocols[i] + '://' + address + ':' + ports[i]));

			//_luci2.network.getNetworkStatus(function(s) {
			//	for (var i = 0; i < protocols.length; i++)
			//	{
			//		for (var j = 0; j < s.length; j++)
			//		{
			//			for (var k = 0; k < s[j]['ipv4-address'].length; k++)
			//				images = images.add($('<img />').attr('url', protocols[i] + '://' + s[j]['ipv4-address'][k].address + ':' + ports[i]));
			//
			//			for (var l = 0; l < s[j]['ipv6-address'].length; l++)
			//				images = images.add($('<img />').attr('url', protocols[i] + '://[' + s[j]['ipv6-address'][l].address + ']:' + ports[i]));
			//		}
			//	}
			//}).then(function() {
				images.on('load', function() {
					var url = this.getAttribute('url');
					_luci2.rpc.access('ubus', 'session', 'access').then(function(response) {
						if (response[0] == 0)
						{
							window.clearTimeout(timeout);
							window.clearInterval(interval);
							_luci2.ui.dialog(false);
							images = null;
						}
						else
						{
							location.href = url;
						}
					});
				});

				interval = window.setInterval(function() {
					images.each(function() {
						this.setAttribute('src', this.getAttribute('url') + _luci2.globals.resource + '/icons/loading.gif?r=' + Math.random());
					});
				}, 5000);

				timeout = window.setTimeout(function() {
					window.clearInterval(interval);
					images.off('load');

					_luci2.ui.dialog(
						_luci2.tr('Device not responding'),
						_luci2.tr('The device was not responding within 180 seconds, you might need to manually reconnect your computer or use SSH to regain access.'),
						{ style: 'close' }
					);
				}, 180000);
			//});
		},

		login: function(invalid)
		{
			if (!_luci2._login_deferred || _luci2._login_deferred.state() != 'pending')
				_luci2._login_deferred = $.Deferred();

			/* try to find sid from hash */
			var sid = _luci2.getHash('id');
			if (sid && sid.match(/^[a-f0-9]{32}$/))
			{
				_luci2.globals.sid = sid;
				_luci2.rpc.access('ubus', 'session', 'access').then(function(response) {
					if (response[0] == 0)
					{
						_luci2._login_deferred.resolve();
					}
					else
					{
						_luci2.setHash('id', undefined);
						_luci2.ui.login();
					}
				});

				return _luci2._login_deferred;
			}

			var form = _luci2._login || (
				_luci2._login = $('<div />')
					.append($('<p />')
						.addClass('alert-message')
						.text(_luci2.tr('Wrong username or password given!')))
					.append($('<p />')
						.append($('<label />')
							.text(_luci2.tr('Username'))
							.append($('<br />'))
							.append($('<input />')
								.attr('type', 'text')
								.attr('name', 'username')
								.attr('value', 'root')
								.addClass('cbi-input-text'))))
					.append($('<p />')
						.append($('<label />')
							.text(_luci2.tr('Password'))
							.append($('<br />'))
							.append($('<input />')
								.attr('type', 'password')
								.attr('name', 'password')
								.addClass('cbi-input-password'))))
					.append($('<p />')
						.text(_luci2.tr('Enter your username and password above, then click "%s" to proceed.').format(_luci2.tr('Ok'))))
			);

			var response = _luci2._login_response_cb || (
				_luci2._login_response_cb = function(data) {
					if (typeof(data) == 'object' && typeof(data.sessionid) == 'string')
					{
						_luci2.globals.sid = data.sessionid;
						_luci2.setHash('id', _luci2.globals.sid);

						_luci2.ui.dialog(false);
						_luci2._login_deferred.resolve();
					}
					else
					{
						_luci2.ui.login(true);
					}
				}
			);

			var confirm = _luci2._login_confirm_cb || (
				_luci2._login_confirm_cb = function() {
					var d = _luci2._login;
					var u = d.find('[name=username]').val();
					var p = d.find('[name=password]').val();

					if (!u)
						return;

					_luci2.ui.dialog(
						_luci2.tr('Logging in'), [
							$('<p />').text(_luci2.tr('Log in in progress …')),
							$('<div />')
								.css('width', '100%')
								.addClass('progressbar')
								.addClass('intermediate')
								.append($('<div />')
									.css('width', '100%'))
						], { style: 'wait' }
					);

					$.ajax('/cgi-bin/luci-login', {
						type:        'POST',
						cache:       false,
						data:        { username: u, password: p },
						dataType:    'json',
						success:     response,
						error:       response
					});
				}
			);

			if (invalid)
				form.find('.alert-message').show();
			else
				form.find('.alert-message').hide();

			_luci2.ui.dialog(_luci2.tr('Authorization Required'), form, {
				style: 'confirm',
				confirm: confirm
			});

			return _luci2._login_deferred;
		},

		renderMainMenu: function()
		{
			return rcall('luci2.ui', 'menu', undefined, 'menu', { }, function(entries) {
				_luci2.globals.mainMenu = new _luci2.ui.menu();
				_luci2.globals.mainMenu.entries(entries);

				$('#mainmenu')
					.empty()
					.append(_luci2.globals.mainMenu.render(0, 1));
			});
		},

		renderViewMenu: function()
		{
			$('#viewmenu')
				.empty()
				.append(_luci2.globals.mainMenu.render(2, 900));
		},

		renderView: function(node)
		{
			var name = node.view.split(/\//).join('.');

			_luci2.ui.renderViewMenu();

			if (!_luci2._views)
				_luci2._views = { };

			_luci2.setHash('view', node.view);

			if (_luci2._views[name] instanceof _luci2.ui.view)
				return _luci2._views[name].render();

			return $.ajax(_luci2.globals.resource + '/view/' + name + '.js', {
				method: 'GET',
				cache: true,
				dataType: 'text'
			}).then(function(data) {
				try {
					var viewConstructor = (new Function(['L', '$'], 'return ' + data))(_luci2, $);

					_luci2._views[name] = new viewConstructor({
						name: name,
						acls: node.write || { }
					});

					return _luci2._views[name].render();
				}
				catch(e) { };

				return $.Deferred().resolve();
			});
		},

		init: function()
		{
			_luci2.ui.loading(true);

			$.when(
				_luci2.ui.renderMainMenu()
			).then(function() {
				_luci2.ui.renderView(_luci2.globals.defaultNode).then(function() {
					_luci2.ui.loading(false);
				})
			});
		}
	};

	var AbstractWidget = Class.extend({
		i18n: function(text) {
			return text;
		},

		toString: function() {
			var x = document.createElement('div');
				x.appendChild(this.render());

			return x.innerHTML;
		},

		insertInto: function(id) {
			return $(id).empty().append(this.render());
		}
	});

	this.ui.view = AbstractWidget.extend({
		_fetch_template: function()
		{
			return $.ajax(_luci2.globals.resource + '/template/' + this.options.name + '.htm', {
				method: 'GET',
				cache: true,
				dataType: 'text',
				success: function(data) {
					data = data.replace(/<%([#:=])?(.+?)%>/g, function(match, p1, p2) {
						p2 = p2.replace(/^\s+/, '').replace(/\s+$/, '');
						switch (p1)
						{
						case '#':
							return '';

						case ':':
							return _luci2.tr(p2);

						case '=':
							return _luci2.globals[p2] || '';

						default:
							return '(?' + match + ')';
						}
					});

					$('#maincontent').append(data);
				}
			});
		},

		execute: function()
		{
			throw "Not implemented";
		},

		render: function()
		{
			var container = $('#maincontent');

			container.empty();

			if (this.title)
				container.append($('<h2 />').append(this.title));

			if (this.description)
				container.append($('<div />').addClass('cbi-map-descr').append(this.description));

			var self = this;
			return this._fetch_template().then(function() {
				return _luci2.deferrable(self.execute());
			});
		}
	});

	this.ui.menu = AbstractWidget.extend({
		init: function() {
			this._nodes = { };
		},

		entries: function(entries)
		{
			for (var entry in entries)
			{
				var path = entry.split(/\//);
				var node = this._nodes;

				for (i = 0; i < path.length; i++)
				{
					if (!node.childs)
						node.childs = { };

					if (!node.childs[path[i]])
						node.childs[path[i]] = { };

					node = node.childs[path[i]];
				}

				$.extend(node, entries[entry]);
			}
		},

		_indexcmp: function(a, b)
		{
			var x = a.index || 0;
			var y = b.index || 0;
			return (x - y);
		},

		firstChildView: function(node)
		{
			if (node.view)
				return node;

			var nodes = [ ];
			for (var child in (node.childs || { }))
				nodes.push(node.childs[child]);

			nodes.sort(this._indexcmp);

			for (var i = 0; i < nodes.length; i++)
			{
				var child = this.firstChildView(nodes[i]);
				if (child)
				{
					$.extend(node, child);
					return node;
				}
			}

			return undefined;
		},

		_onclick: function(ev)
		{
			_luci2.ui.loading(true);
			_luci2.ui.renderView(ev.data).then(function() {
				_luci2.ui.loading(false);
			});

			ev.preventDefault();
			this.blur();
		},

		_render: function(childs, level, min, max)
		{
			var nodes = [ ];
			for (var node in childs)
			{
				var child = this.firstChildView(childs[node]);
				if (child)
					nodes.push(childs[node]);
			}

			nodes.sort(this._indexcmp);

			var list = $('<ul />');

			if (level == 0)
				list.addClass('nav');
			else if (level == 1)
				list.addClass('dropdown-menu');

			for (var i = 0; i < nodes.length; i++)
			{
				if (!_luci2.globals.defaultNode)
				{
					var v = _luci2.getHash('view');
					if (!v || v == nodes[i].view)
						_luci2.globals.defaultNode = nodes[i];
				}

				var item = $('<li />')
					.append($('<a />')
						.attr('href', '#')
						.text(_luci2.tr(nodes[i].title))
						.click(nodes[i], this._onclick))
					.appendTo(list);

				if (nodes[i].childs && level < max)
				{
					item.addClass('dropdown');
					item.find('a').addClass('menu');
					item.append(this._render(nodes[i].childs, level + 1));
				}
			}

			return list.get(0);
		},

		render: function(min, max)
		{
			var top = min ? this.getNode(_luci2.globals.defaultNode.view, min) : this._nodes;
			return this._render(top.childs, 0, min, max);
		},

		getNode: function(path, max)
		{
			var p = path.split(/\//);
			var n = this._nodes;

			if (typeof(max) == 'undefined')
				max = p.length;

			for (var i = 0; i < max; i++)
			{
				if (!n.childs[p[i]])
					return undefined;

				n = n.childs[p[i]];
			}

			return n;
		}
	});

	this.ui.table = AbstractWidget.extend({
		init: function()
		{
			this._rows = [ ];
		},

		row: function(values)
		{
			if (isa(values, 'Array'))
			{
				this._rows.push(values);
			}
			else if (isa(values, 'Object'))
			{
				var v = [ ];
				for (var i = 0; i < this.options.columns.length; i++)
				{
					var col = this.options.columns[i];

					if (typeof col.key == 'string')
						v.push(values[col.key]);
					else
						v.push(null);
				}
				this._rows.push(v);
			}
		},

		rows: function(rows)
		{
			for (var i = 0; i < rows.length; i++)
				this.row(rows[i]);
		},

		render: function(id)
		{
			var fieldset = document.createElement('fieldset');
				fieldset.className = 'cbi-section';

			if (this.options.caption)
			{
				var legend = document.createElement('legend');
				$(legend).append(this.options.caption);
				fieldset.appendChild(legend);
			}

			var table = document.createElement('table');
				table.className = 'cbi-section-table';

			var has_caption = false;
			var has_description = false;

			for (var i = 0; i < this.options.columns.length; i++)
				if (this.options.columns[i].caption)
				{
					has_caption = true;
					break;
				}
				else if (this.options.columns[i].description)
				{
					has_description = true;
					break;
				}

			if (has_caption)
			{
				var tr = table.insertRow(-1);
					tr.className = 'cbi-section-table-titles';

				for (var i = 0; i < this.options.columns.length; i++)
				{
					var col = this.options.columns[i];
					var th = document.createElement('th');
						th.className = 'cbi-section-table-cell';

					tr.appendChild(th);

					if (col.width)
						th.style.width = col.width;

					if (col.align)
						th.style.textAlign = col.align;

					if (col.caption)
						$(th).append(col.caption);
				}
			}

			if (has_description)
			{
				var tr = table.insertRow(-1);
					tr.className = 'cbi-section-table-descr';

				for (var i = 0; i < this.options.columns.length; i++)
				{
					var col = this.options.columns[i];
					var th = document.createElement('th');
						th.className = 'cbi-section-table-cell';

					tr.appendChild(th);

					if (col.width)
						th.style.width = col.width;

					if (col.align)
						th.style.textAlign = col.align;

					if (col.description)
						$(th).append(col.description);
				}
			}

			if (this._rows.length == 0)
			{
				if (this.options.placeholder)
				{
					var tr = table.insertRow(-1);
					var td = tr.insertCell(-1);
						td.className = 'cbi-section-table-cell';

					td.colSpan = this.options.columns.length;
					$(td).append(this.options.placeholder);
				}
			}
			else
			{
				for (var i = 0; i < this._rows.length; i++)
				{
					var tr = table.insertRow(-1);

					for (var j = 0; j < this.options.columns.length; j++)
					{
						var col = this.options.columns[j];
						var td = tr.insertCell(-1);

						var val = this._rows[i][j];

						if (typeof(val) == 'undefined')
							val = col.placeholder;

						if (typeof(val) == 'undefined')
							val = '';

						if (col.width)
							td.style.width = col.width;

						if (col.align)
							td.style.textAlign = col.align;

						if (typeof col.format == 'string')
							$(td).append(col.format.format(val));
						else if (typeof col.format == 'function')
							$(td).append(col.format(val, i));
						else
							$(td).append(val);
					}
				}
			}

			this._rows = [ ];
			fieldset.appendChild(table);

			return fieldset;
		}
	});

	this.ui.progress = AbstractWidget.extend({
		render: function()
		{
			var vn = parseInt(this.options.value) || 0;
			var mn = parseInt(this.options.max) || 100;
			var pc = Math.floor((100 / mn) * vn);

			var bar = document.createElement('div');
				bar.className = 'progressbar';

			bar.appendChild(document.createElement('div'));
			bar.lastChild.appendChild(document.createElement('div'));
			bar.lastChild.style.width = pc + '%';

			if (typeof(this.options.format) == 'string')
				$(bar.lastChild.lastChild).append(this.options.format.format(this.options.value, this.options.max, pc));
			else if (typeof(this.options.format) == 'function')
				$(bar.lastChild.lastChild).append(this.options.format(pc));
			else
				$(bar.lastChild.lastChild).append('%.2f%%'.format(pc));

			return bar;
		}
	});

	this.ui.devicebadge = AbstractWidget.extend({
		render: function()
		{
			var dev = this.options.l3_device || this.options.device || '?';

			var span = document.createElement('span');
				span.className = 'ifacebadge';

			if (typeof(this.options.signal) == 'number' ||
				typeof(this.options.noise) == 'number')
			{
				var r = 'none';
				if (typeof(this.options.signal) != 'undefined' &&
					typeof(this.options.noise) != 'undefined')
				{
					var q = (-1 * (this.options.noise - this.options.signal)) / 5;
					if (q < 1)
						r = '0';
					else if (q < 2)
						r = '0-25';
					else if (q < 3)
						r = '25-50';
					else if (q < 4)
						r = '50-75';
					else
						r = '75-100';
				}

				span.appendChild(document.createElement('img'));
				span.lastChild.src = _luci2.globals.resource + '/icons/signal-' + r + '.png';

				if (r == 'none')
					span.title = _luci2.tr('No signal');
				else
					span.title = '%s: %d %s / %s: %d %s'.format(
						_luci2.tr('Signal'), this.options.signal, _luci2.tr('dBm'),
						_luci2.tr('Noise'), this.options.noise, _luci2.tr('dBm')
					);
			}
			else
			{
				var type = 'ethernet';
				var desc = _luci2.tr('Ethernet device');

				if (this.options.l3_device != this.options.device)
				{
					type = 'tunnel';
					desc = _luci2.tr('Tunnel interface');
				}
				else if (dev.indexOf('br-') == 0)
				{
					type = 'bridge';
					desc = _luci2.tr('Bridge');
				}
				else if (dev.indexOf('.') > 0)
				{
					type = 'vlan';
					desc = _luci2.tr('VLAN interface');
				}
				else if (dev.indexOf('wlan') == 0 ||
						 dev.indexOf('ath') == 0 ||
						 dev.indexOf('wl') == 0)
				{
					type = 'wifi';
					desc = _luci2.tr('Wireless Network');
				}

				span.appendChild(document.createElement('img'));
				span.lastChild.src = _luci2.globals.resource + '/icons/' + type + (this.options.up ? '' : '_disabled') + '.png';
				span.title = desc;
			}

			$(span).append(' ');
			$(span).append(dev);

			return span;
		}
	});

	var type = function(f, l)
	{
		f.message = l;
		return f;
	};

	this.cbi = {
		validation: {
			i18n: function(msg)
			{
				_luci2.cbi.validation.message = _luci2.tr(msg);
			},

			compile: function(code)
			{
				var pos = 0;
				var esc = false;
				var depth = 0;
				var types = _luci2.cbi.validation.types;
				var stack = [ ];

				code += ',';

				for (var i = 0; i < code.length; i++)
				{
					if (esc)
					{
						esc = false;
						continue;
					}

					switch (code.charCodeAt(i))
					{
					case 92:
						esc = true;
						break;

					case 40:
					case 44:
						if (depth <= 0)
						{
							if (pos < i)
							{
								var label = code.substring(pos, i);
									label = label.replace(/\\(.)/g, '$1');
									label = label.replace(/^[ \t]+/g, '');
									label = label.replace(/[ \t]+$/g, '');

								if (label && !isNaN(label))
								{
									stack.push(parseFloat(label));
								}
								else if (label.match(/^(['"]).*\1$/))
								{
									stack.push(label.replace(/^(['"])(.*)\1$/, '$2'));
								}
								else if (typeof types[label] == 'function')
								{
									stack.push(types[label]);
									stack.push(null);
								}
								else
								{
									throw "Syntax error, unhandled token '"+label+"'";
								}
							}
							pos = i+1;
						}
						depth += (code.charCodeAt(i) == 40);
						break;

					case 41:
						if (--depth <= 0)
						{
							if (typeof stack[stack.length-2] != 'function')
								throw "Syntax error, argument list follows non-function";

							stack[stack.length-1] =
								arguments.callee(code.substring(pos, i));

							pos = i+1;
						}
						break;
					}
				}

				return stack;
			}
		}
	};

	var validation = this.cbi.validation;

	validation.types = {
		'integer': function()
		{
			if (this.match(/^-?[0-9]+$/) != null)
				return true;

			validation.i18n('Must be a valid integer');
			return false;
		},

		'uinteger': function()
		{
			if (validation.types['integer'].apply(this) && (this >= 0))
				return true;

			validation.i18n('Must be a positive integer');
			return false;
		},

		'float': function()
		{
			if (!isNaN(parseFloat(this)))
				return true;

			validation.i18n('Must be a valid number');
			return false;
		},

		'ufloat': function()
		{
			if (validation.types['float'].apply(this) && (this >= 0))
				return true;

			validation.i18n('Must be a positive number');
			return false;
		},

		'ipaddr': function()
		{
			if (validation.types['ip4addr'].apply(this) ||
				validation.types['ip6addr'].apply(this))
				return true;

			validation.i18n('Must be a valid IP address');
			return false;
		},

		'ip4addr': function()
		{
			if (this.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\S+))?$/))
			{
				if ((RegExp.$1 >= 0) && (RegExp.$1 <= 255) &&
				    (RegExp.$2 >= 0) && (RegExp.$2 <= 255) &&
				    (RegExp.$3 >= 0) && (RegExp.$3 <= 255) &&
				    (RegExp.$4 >= 0) && (RegExp.$4 <= 255) &&
				    ((RegExp.$6.indexOf('.') < 0)
				      ? ((RegExp.$6 >= 0) && (RegExp.$6 <= 32))
				      : (validation.types['ip4addr'].apply(RegExp.$6))))
					return true;
			}

			validation.i18n('Must be a valid IPv4 address');
			return false;
		},

		'ip6addr': function()
		{
			if (this.match(/^([a-fA-F0-9:.]+)(\/(\d+))?$/))
			{
				if (!RegExp.$2 || ((RegExp.$3 >= 0) && (RegExp.$3 <= 128)))
				{
					var addr = RegExp.$1;

					if (addr == '::')
					{
						return true;
					}

					if (addr.indexOf('.') > 0)
					{
						var off = addr.lastIndexOf(':');

						if (!(off && validation.types['ip4addr'].apply(addr.substr(off+1))))
						{
							validation.i18n('Must be a valid IPv6 address');
							return false;
						}

						addr = addr.substr(0, off) + ':0:0';
					}

					if (addr.indexOf('::') >= 0)
					{
						var colons = 0;
						var fill = '0';

						for (var i = 1; i < (addr.length-1); i++)
							if (addr.charAt(i) == ':')
								colons++;

						if (colons > 7)
						{
							validation.i18n('Must be a valid IPv6 address');
							return false;
						}

						for (var i = 0; i < (7 - colons); i++)
							fill += ':0';

						if (addr.match(/^(.*?)::(.*?)$/))
							addr = (RegExp.$1 ? RegExp.$1 + ':' : '') + fill +
								   (RegExp.$2 ? ':' + RegExp.$2 : '');
					}

					if (addr.match(/^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/) != null)
						return true;

					validation.i18n('Must be a valid IPv6 address');
					return false;
				}
			}

			return false;
		},

		'port': function()
		{
			if (validation.types['integer'].apply(this) &&
				(this >= 0) && (this <= 65535))
				return true;

			validation.i18n('Must be a valid port number');
			return false;
		},

		'portrange': function()
		{
			if (this.match(/^(\d+)-(\d+)$/))
			{
				var p1 = RegExp.$1;
				var p2 = RegExp.$2;

				if (validation.types['port'].apply(p1) &&
				    validation.types['port'].apply(p2) &&
				    (parseInt(p1) <= parseInt(p2)))
					return true;
			}
			else if (validation.types['port'].apply(this))
			{
				return true;
			}

			validation.i18n('Must be a valid port range');
			return false;
		},

		'macaddr': function()
		{
			if (this.match(/^([a-fA-F0-9]{2}:){5}[a-fA-F0-9]{2}$/) != null)
				return true;

			validation.i18n('Must be a valid MAC address');
			return false;
		},

		'host': function()
		{
			if (validation.types['hostname'].apply(this) ||
			    validation.types['ipaddr'].apply(this))
				return true;

			validation.i18n('Must be a valid hostname or IP address');
			return false;
		},

		'hostname': function()
		{
			if ((this.length <= 253) &&
			    ((this.match(/^[a-zA-Z0-9]+$/) != null ||
			     (this.match(/^[a-zA-Z0-9_][a-zA-Z0-9_\-.]*[a-zA-Z0-9]$/) &&
			      this.match(/[^0-9.]/)))))
				return true;

			validation.i18n('Must be a valid host name');
			return false;
		},

		'network': function()
		{
			if (validation.types['uciname'].apply(this) ||
			    validation.types['host'].apply(this))
				return true;

			validation.i18n('Must be a valid network name');
			return false;
		},

		'wpakey': function()
		{
			var v = this;

			if ((v.length == 64)
			      ? (v.match(/^[a-fA-F0-9]{64}$/) != null)
				  : ((v.length >= 8) && (v.length <= 63)))
				return true;

			validation.i18n('Must be a valid WPA key');
			return false;
		},

		'wepkey': function()
		{
			var v = this;

			if (v.substr(0,2) == 's:')
				v = v.substr(2);

			if (((v.length == 10) || (v.length == 26))
			      ? (v.match(/^[a-fA-F0-9]{10,26}$/) != null)
			      : ((v.length == 5) || (v.length == 13)))
				return true;

			validation.i18n('Must be a valid WEP key');
			return false;
		},

		'uciname': function()
		{
			if (this.match(/^[a-zA-Z0-9_]+$/) != null)
				return true;

			validation.i18n('Must be a valid UCI identifier');
			return false;
		},

		'range': function(min, max)
		{
			var val = parseFloat(this);

			if (validation.types['integer'].apply(this) &&
			    !isNaN(min) && !isNaN(max) && ((val >= min) && (val <= max)))
				return true;

			validation.i18n('Must be a number between %d and %d');
			return false;
		},

		'min': function(min)
		{
			var val = parseFloat(this);

			if (validation.types['integer'].apply(this) &&
			    !isNaN(min) && !isNaN(val) && (val >= min))
				return true;

			validation.i18n('Must be a number greater or equal to %d');
			return false;
		},

		'max': function(max)
		{
			var val = parseFloat(this);

			if (validation.types['integer'].apply(this) &&
			    !isNaN(max) && !isNaN(val) && (val <= max))
				return true;

			validation.i18n('Must be a number lower or equal to %d');
			return false;
		},

		'rangelength': function(min, max)
		{
			var val = '' + this;

			if (!isNaN(min) && !isNaN(max) &&
			    (val.length >= min) && (val.length <= max))
				return true;

			validation.i18n('Must be between %d and %d characters');
			return false;
		},

		'minlength': function(min)
		{
			var val = '' + this;

			if (!isNaN(min) && (val.length >= min))
				return true;

			validation.i18n('Must be at least %d characters');
			return false;
		},

		'maxlength': function(max)
		{
			var val = '' + this;

			if (!isNaN(max) && (val.length <= max))
				return true;

			validation.i18n('Must be at most %d characters');
			return false;
		},

		'or': function()
		{
			var msgs = [ ];

			for (var i = 0; i < arguments.length; i += 2)
			{
				delete validation.message;

				if (typeof(arguments[i]) != 'function')
				{
					if (arguments[i] == this)
						return true;
					i--;
				}
				else if (arguments[i].apply(this, arguments[i+1]))
				{
					return true;
				}

				if (validation.message)
					msgs.push(validation.message.format.apply(validation.message, arguments[i+1]));
			}

			validation.message = msgs.join( _luci2.tr(' - or - '));
			return false;
		},

		'and': function()
		{
			var msgs = [ ];

			for (var i = 0; i < arguments.length; i += 2)
			{
				delete validation.message;

				if (typeof arguments[i] != 'function')
				{
					if (arguments[i] != this)
						return false;
					i--;
				}
				else if (!arguments[i].apply(this, arguments[i+1]))
				{
					return false;
				}

				if (validation.message)
					msgs.push(validation.message.format.apply(validation.message, arguments[i+1]));
			}

			validation.message = msgs.join(', ');
			return true;
		},

		'neg': function()
		{
			return validation.types['or'].apply(
				this.replace(/^[ \t]*![ \t]*/, ''), arguments);
		},

		'list': function(subvalidator, subargs)
		{
			if (typeof subvalidator != 'function')
				return false;

			var tokens = this.match(/[^ \t]+/g);
			for (var i = 0; i < tokens.length; i++)
				if (!subvalidator.apply(tokens[i], subargs))
					return false;

			return true;
		},

		'phonedigit': function()
		{
			if (this.match(/^[0-9\*#!\.]+$/) != null)
				return true;

			validation.i18n('Must be a valid phone number digit');
			return false;
		},

		'string': function()
		{
			return true;
		}
	};


	var AbstractValue = AbstractWidget.extend({
		init: function(name, options)
		{
			this.name = name;
			this.instance = { };
			this.dependencies = [ ];
			this.rdependency = { };

			this.options = _luci2.defaults(options, {
				placeholder: '',
				datatype: 'string',
				optional: false,
				keep: true
			});
		},

		id: function(sid)
		{
			return this.section.id('field', sid || '__unknown__', this.name);
		},

		render: function(sid)
		{
			var i = this.instance[sid] = { };

			i.top = $('<div />').addClass('cbi-value');

			if (typeof(this.options.caption) == 'string')
				$('<label />')
					.addClass('cbi-value-title')
					.attr('for', this.id(sid))
					.text(this.options.caption)
					.appendTo(i.top);

			i.widget = $('<div />').addClass('cbi-value-field').append(this.widget(sid)).appendTo(i.top);
			i.error = $('<div />').addClass('cbi-value-error').appendTo(i.top);

			if (typeof(this.options.description) == 'string')
				$('<div />')
					.addClass('cbi-value-description')
					.text(this.options.description)
					.appendTo(i.top);

			return i.top;
		},

		ucipath: function(sid)
		{
			return {
				config:  (this.options.uci_package || this.map.uci_package),
				section: (this.options.uci_section || sid),
				option:  (this.options.uci_option  || this.name)
			};
		},

		ucivalue: function(sid)
		{
			var uci = this.ucipath(sid);
			var val = this.map.get(uci.config, uci.section, uci.option);

			if (typeof(val) == 'undefined')
				return this.options.initial;

			return val;
		},

		formvalue: function(sid)
		{
			var v = $('#' + this.id(sid)).val();
			return (v === '') ? undefined : v;
		},

		textvalue: function(sid)
		{
			var v = this.formvalue(sid);

			if (typeof(v) == 'undefined' || ($.isArray(v) && !v.length))
				v = this.ucivalue(sid);

			if (typeof(v) == 'undefined' || ($.isArray(v) && !v.length))
				v = this.options.placeholder;

			if (typeof(v) == 'undefined' || v === '')
				return undefined;

			if (typeof(v) == 'string' && $.isArray(this.choices))
			{
				for (var i = 0; i < this.choices.length; i++)
					if (v === this.choices[i][0])
						return this.choices[i][1];
			}
			else if (v === true)
				return _luci2.tr('yes');
			else if (v === false)
				return _luci2.tr('no');
			else if ($.isArray(v))
				return v.join(', ');

			return v;
		},

		changed: function(sid)
		{
			var a = this.ucivalue(sid);
			var b = this.formvalue(sid);

			if (typeof(a) != typeof(b))
				return true;

			if (typeof(a) == 'object')
			{
				if (a.length != b.length)
					return true;

				for (var i = 0; i < a.length; i++)
					if (a[i] != b[i])
						return true;

				return false;
			}

			return (a != b);
		},

		save: function(sid)
		{
			var uci = this.ucipath(sid);

			if (this.instance[sid].disabled)
			{
				if (!this.options.keep)
					return this.map.set(uci.config, uci.section, uci.option, undefined);

				return false;
			}

			var chg = this.changed(sid);
			var val = this.formvalue(sid);

			if (chg)
				this.map.set(uci.config, uci.section, uci.option, val);

			return chg;
		},

		validator: function(sid, elem, multi)
		{
			if (typeof(this.options.datatype) == 'undefined' && $.isEmptyObject(this.rdependency))
				return elem;

			var vstack;
			if (typeof(this.options.datatype) == 'string')
			{
				try {
					vstack = _luci2.cbi.validation.compile(this.options.datatype);
				} catch(e) { };
			}
			else if (typeof(this.options.datatype) == 'function')
			{
				var vfunc = this.options.datatype;
				vstack = [ function(elem) {
					var rv = vfunc(this, elem);
					if (rv !== true)
						validation.message = rv;
					return (rv === true);
				}, [ elem ] ];
			}

			var evdata = {
				self:  this,
				sid:   sid,
				elem:  elem,
				multi: multi,
				inst:  this.instance[sid],
				opt:   this.options.optional
			};

			var validator = function(ev)
			{
				var d = ev.data;
				var rv = true;
				var val = d.elem.val();

				if (vstack && typeof(vstack[0]) == 'function')
				{
					delete validation.message;

					if ((val.length == 0 && !d.opt))
					{
						d.elem.addClass('error');
						d.inst.top.addClass('error');
						d.inst.error.text(_luci2.tr('Field must not be empty'));
						rv = false;
					}
					else if (val.length > 0 && !vstack[0].apply(val, vstack[1]))
					{
						d.elem.addClass('error');
						d.inst.top.addClass('error');
						d.inst.error.text(validation.message.format.apply(validation.message, vstack[1]));
						rv = false;
					}
					else
					{
						d.elem.removeClass('error');

						if (d.multi && d.inst.widget.find('input.error, select.error').length > 0)
						{
							rv = false;
						}
						else
						{
							d.inst.top.removeClass('error');
							d.inst.error.text('');
						}
					}
				}

				if (rv)
				{
					for (var field in d.self.rdependency)
						d.self.rdependency[field].toggle(d.sid);
				}

				return rv;
			};

			if (elem.prop('tagName') == 'SELECT')
			{
				elem.change(evdata, validator);
			}
			else if (elem.prop('tagName') == 'INPUT' && elem.attr('type') == 'checkbox')
			{
				elem.click(evdata, validator);
				elem.blur(evdata, validator);
			}
			else
			{
				elem.keyup(evdata, validator);
				elem.blur(evdata, validator);
			}

			elem.attr('cbi-validate', true).on('validate', evdata, validator);

			return elem;
		},

		validate: function(sid)
		{
			var i = this.instance[sid];

			i.widget.find('[cbi-validate]').trigger('validate');

			return (i.disabled || i.error.text() == '');
		},

		depends: function(d, v)
		{
			var dep;

			if ($.isArray(d))
			{
				dep = { };
				for (var i = 0; i < d.length; i++)
				{
					if (typeof(d[i]) == 'string')
						dep[d[i]] = true;
					else if (d[i] instanceof AbstractValue)
						dep[d[i].name] = true;
				}
			}
			else if (d instanceof AbstractValue)
			{
				dep = { };
				dep[d.name] = (typeof(v) == 'undefined') ? true : v;
			}
			else if (typeof(d) == 'object')
			{
				dep = d;
			}
			else if (typeof(d) == 'string')
			{
				dep = { };
				dep[d] = (typeof(v) == 'undefined') ? true : v;
			}

			if (!dep || $.isEmptyObject(dep))
				return this;

			for (var field in dep)
			{
				var f = this.section.fields[field];
				if (f)
					f.rdependency[this.name] = this;
				else
					delete dep[field];
			}

			if ($.isEmptyObject(dep))
				return this;

			this.dependencies.push(dep);

			return this;
		},

		toggle: function(sid)
		{
			var d = this.dependencies;
			var i = this.instance[sid];

			if (!d.length)
				return true;

			for (var n = 0; n < d.length; n++)
			{
				var rv = true;

				for (var field in d[n])
				{
					var val = this.section.fields[field].formvalue(sid);
					var cmp = d[n][field];

					if (typeof(cmp) == 'boolean')
					{
						if (cmp == (typeof(val) == 'undefined' || val === '' || val === false))
						{
							rv = false;
							break;
						}
					}
					else if (typeof(cmp) == 'string')
					{
						if (val != cmp)
						{
							rv = false;
							break;
						}
					}
					else if (typeof(cmp) == 'function')
					{
						if (!cmp(val))
						{
							rv = false;
							break;
						}
					}
					else if (cmp instanceof RegExp)
					{
						if (!cmp.test(val))
						{
							rv = false;
							break;
						}
					}
				}

				if (rv)
				{
					if (i.disabled)
					{
						i.disabled = false;
						i.top.fadeIn();
					}

					return true;
				}
			}

			if (!i.disabled)
			{
				i.disabled = true;
				i.top.is(':visible') ? i.top.fadeOut() : i.top.hide();
			}

			return false;
		}
	});

	this.cbi.CheckboxValue = AbstractValue.extend({
		widget: function(sid)
		{
			var o = this.options;

			if (typeof(o.enabled)  == 'undefined') o.enabled  = '1';
			if (typeof(o.disabled) == 'undefined') o.disabled = '0';

			var i = $('<input />')
				.attr('id', this.id(sid))
				.attr('type', 'checkbox')
				.prop('checked', this.ucivalue(sid));

			return this.validator(sid, i);
		},

		ucivalue: function(sid)
		{
			var v = this.callSuper('ucivalue', sid);

			if (typeof(v) == 'boolean')
				return v;

			return (v == this.options.enabled);
		},

		formvalue: function(sid)
		{
			var v = $('#' + this.id(sid)).prop('checked');

			if (typeof(v) == 'undefined')
				return !!this.options.initial;

			return v;
		},

		save: function(sid)
		{
			var uci = this.ucipath(sid);

			if (this.instance[sid].disabled)
			{
				if (!this.options.keep)
					return this.map.set(uci.config, uci.section, uci.option, undefined);

				return false;
			}

			var chg = this.changed(sid);
			var val = this.formvalue(sid);

			if (chg)
			{
				val = val ? this.options.enabled : this.options.disabled;

				if (this.options.optional && val == this.options.initial)
					this.map.set(uci.config, uci.section, uci.option, undefined);
				else
					this.map.set(uci.config, uci.section, uci.option, val);
			}

			return chg;
		}
	});

	this.cbi.InputValue = AbstractValue.extend({
		widget: function(sid)
		{
			var i = $('<input />')
				.attr('id', this.id(sid))
				.attr('type', 'text')
				.attr('placeholder', this.options.placeholder)
				.val(this.ucivalue(sid));

			return this.validator(sid, i);
		}
	});

	this.cbi.PasswordValue = AbstractValue.extend({
		widget: function(sid)
		{
			var i = $('<input />')
				.attr('id', this.id(sid))
				.attr('type', 'password')
				.attr('placeholder', this.options.placeholder)
				.val(this.ucivalue(sid));

			var t = $('<img />')
				.attr('src', _luci2.globals.resource + '/icons/cbi/reload.gif')
				.attr('title', _luci2.tr('Reveal or hide password'))
				.addClass('cbi-button')
				.click(function(ev) {
					var i = $(this).prev();
					var t = i.attr('type');
					i.attr('type', (t == 'password') ? 'text' : 'password');
					i = t = null;
				});

			this.validator(sid, i);

			return $('<div />')
				.addClass('cbi-input-password')
				.append(i)
				.append(t);
		}
	});

	this.cbi.ListValue = AbstractValue.extend({
		widget: function(sid)
		{
			var s = $('<select />');

			if (this.options.optional)
				$('<option />')
					.attr('value', '')
					.text(_luci2.tr('-- Please choose --'))
					.appendTo(s);

			if (this.choices)
				for (var i = 0; i < this.choices.length; i++)
					$('<option />')
						.attr('value', this.choices[i][0])
						.text(this.choices[i][1])
						.appendTo(s);

			s.attr('id', this.id(sid)).val(this.ucivalue(sid));

			return this.validator(sid, s);
		},

		value: function(k, v)
		{
			if (!this.choices)
				this.choices = [ ];

			this.choices.push([k, v || k]);
			return this;
		}
	});

	this.cbi.MultiValue = this.cbi.ListValue.extend({
		widget: function(sid)
		{
			var v = this.ucivalue(sid);
			var t = $('<div />').attr('id', this.id(sid));

			if (!$.isArray(v))
				v = (typeof(v) != 'undefined') ? v.toString().split(/\s+/) : [ ];

			var s = { };
			for (var i = 0; i < v.length; i++)
				s[v[i]] = true;

			if (this.choices)
				for (var i = 0; i < this.choices.length; i++)
				{
					$('<label />')
						.append($('<input />')
							.addClass('cbi-input-checkbox')
							.attr('type', 'checkbox')
							.attr('value', this.choices[i][0])
							.prop('checked', s[this.choices[i][0]]))
						.append(this.choices[i][1])
						.appendTo(t);

					$('<br />')
						.appendTo(t);
				}

			return t;
		},

		formvalue: function(sid)
		{
			var rv = [ ];
			var fields = $('#' + this.id(sid) + ' > label > input');

			for (var i = 0; i < fields.length; i++)
				if (fields[i].checked)
					rv.push(fields[i].getAttribute('value'));

			return rv;
		},

		textvalue: function(sid)
		{
			var v = this.formvalue(sid);
			var c = { };

			if (this.choices)
				for (var i = 0; i < this.choices.length; i++)
					c[this.choices[i][0]] = this.choices[i][1];

			var t = [ ];

			for (var i = 0; i < v.length; i++)
				t.push(c[v[i]] || v[i]);

			return t.join(', ');
		}
	});

	this.cbi.ComboBox = AbstractValue.extend({
		_change: function(ev)
		{
			var s = ev.target;
			var self = ev.data.self;

			if (s.selectedIndex == (s.options.length - 1))
			{
				ev.data.select.hide();
				ev.data.input.show().focus();

				var v = ev.data.input.val();
				ev.data.input.val(' ');
				ev.data.input.val(v);
			}
			else if (self.options.optional && s.selectedIndex == 0)
			{
				ev.data.input.val('');
			}
			else
			{
				ev.data.input.val(ev.data.select.val());
			}
		},

		_blur: function(ev)
		{
			var seen = false;
			var val = this.value;
			var self = ev.data.self;

			ev.data.select.empty();

			if (self.options.optional)
				$('<option />')
					.attr('value', '')
					.text(_luci2.tr('-- please choose --'))
					.appendTo(ev.data.select);

			if (self.choices)
				for (var i = 0; i < self.choices.length; i++)
				{
					if (self.choices[i][0] == val)
						seen = true;

					$('<option />')
						.attr('value', self.choices[i][0])
						.text(self.choices[i][1])
						.appendTo(ev.data.select);
				}

			if (!seen && val != '')
				$('<option />')
					.attr('value', val)
					.text(val)
					.appendTo(ev.data.select);

			$('<option />')
				.attr('value', ' ')
				.text(_luci2.tr('-- custom --'))
				.appendTo(ev.data.select);

			ev.data.input.hide();
			ev.data.select.val(val).show().focus();
		},

		_enter: function(ev)
		{
			if (ev.which != 13)
				return true;

			ev.preventDefault();
			ev.data.self._blur(ev);
			return false;
		},

		widget: function(sid)
		{
			var d = $('<div />')
				.attr('id', this.id(sid));

			var t = $('<input />')
				.attr('type', 'text')
				.hide()
				.appendTo(d);

			var s = $('<select />')
				.appendTo(d);

			var evdata = {
				self: this,
				input: this.validator(sid, t),
				select: this.validator(sid, s)
			};

			s.change(evdata, this._change);
			t.blur(evdata, this._blur);
			t.keydown(evdata, this._enter);

			t.val(this.ucivalue(sid));
			t.blur();

			return d;
		},

		value: function(k, v)
		{
			if (!this.choices)
				this.choices = [ ];

			this.choices.push([k, v || k]);
			return this;
		},

		formvalue: function(sid)
		{
			var v = $('#' + this.id(sid)).children('input').val();
			return (v == '') ? undefined : v;
		}
	});

	this.cbi.DynamicList = this.cbi.ComboBox.extend({
		_redraw: function(focus, add, del, s)
		{
			var v = s.values || [ ];
			delete s.values;

			$(s.parent).children('input').each(function(i) {
				if (i != del)
					v.push(this.value || '');
			});

			$(s.parent).empty();

			if (add >= 0)
			{
				focus = add + 1;
				v.splice(focus, 0, '');
			}
			else if (v.length == 0)
			{
				focus = 0;
				v.push('');
			}

			for (var i = 0; i < v.length; i++)
			{
				var evdata = {
					sid: s.sid,
					self: s.self,
					parent: s.parent,
					index: i
				};

				if (this.choices)
				{
					var txt = $('<input />')
						.attr('type', 'text')
						.hide()
						.appendTo(s.parent);

					var sel = $('<select />')
						.appendTo(s.parent);

					evdata.input = this.validator(s.sid, txt, true);
					evdata.select = this.validator(s.sid, sel, true);

					sel.change(evdata, this._change);
					txt.blur(evdata, this._blur);
					txt.keydown(evdata, this._keydown);

					txt.val(v[i]);
					txt.blur();

					if (i == focus || -(i+1) == focus)
						sel.focus();

					sel = txt = null;
				}
				else
				{
					var f = $('<input />')
						.attr('type', 'text')
						.attr('index', i)
						.attr('placeholder', (i == 0) ? this.options.placeholder : '')
						.addClass('cbi-input-text')
						.keydown(evdata, this._keydown)
						.keypress(evdata, this._keypress)
						.val(v[i]);

					f.appendTo(s.parent);

					if (i == focus)
					{
						f.focus();
					}
					else if (-(i+1) == focus)
					{
						f.focus();

						/* force cursor to end */
						var val = f.val();
						f.val(' ');
						f.val(val);
					}

					evdata.input = this.validator(s.sid, f, true);

					f = null;
				}

				$('<img />')
					.attr('src', _luci2.globals.resource + ((i+1) < v.length ? '/icons/cbi/remove.gif' : '/icons/cbi/add.gif'))
					.attr('title', (i+1) < v.length ? _luci2.tr('Remove entry') : _luci2.tr('Add entry'))
					.addClass('cbi-button')
					.click(evdata, this._btnclick)
					.appendTo(s.parent);

				$('<br />')
					.appendTo(s.parent);

				evdata = null;
			}

			s = null;
		},

		_keypress: function(ev)
		{
			switch (ev.which)
			{
				/* backspace, delete */
				case 8:
				case 46:
					if (ev.data.input.val() == '')
					{
						ev.preventDefault();
						return false;
					}

					return true;

				/* enter, arrow up, arrow down */
				case 13:
				case 38:
				case 40:
					ev.preventDefault();
					return false;
			}

			return true;
		},

		_keydown: function(ev)
		{
			var input = ev.data.input;

			switch (ev.which)
			{
				/* backspace, delete */
				case 8:
				case 46:
					if (input.val().length == 0)
					{
						ev.preventDefault();

						var index = ev.data.index;
						var focus = index;

						if (ev.which == 8)
							focus = -focus;

						ev.data.self._redraw(focus, -1, index, ev.data);
						return false;
					}

					break;

				/* enter */
				case 13:
					ev.data.self._redraw(NaN, ev.data.index, -1, ev.data);
					break;

				/* arrow up */
				case 38:
					var prev = input.prevAll('input:first');
					if (prev.is(':visible'))
						prev.focus();
					else
						prev.next('select').focus();
					break;

				/* arrow down */
				case 40:
					var next = input.nextAll('input:first');
					if (next.is(':visible'))
						next.focus();
					else
						next.next('select').focus();
					break;
			}

			return true;
		},

		_btnclick: function(ev)
		{
			if (!this.getAttribute('disabled'))
			{
				if (ev.target.src.indexOf('remove') > -1)
				{
					var index = ev.data.index;
					ev.data.self._redraw(-index, -1, index, ev.data);
				}
				else
				{
					ev.data.self._redraw(NaN, ev.data.index, -1, ev.data);
				}
			}

			return false;
		},

		widget: function(sid)
		{
			this.options.optional = true;

			var v = this.ucivalue(sid);

			if (!$.isArray(v))
				v = (typeof(v) != 'undefined') ? v.toString().split(/\s+/) : [ ];

			var d = $('<div />')
				.attr('id', this.id(sid))
				.addClass('cbi-input-dynlist');

			this._redraw(NaN, -1, -1, {
				self:      this,
				parent:    d[0],
				values:    v,
				sid:       sid
			});

			return d;
		},

		ucivalue: function(sid)
		{
			var v = this.callSuper('ucivalue', sid);

			if (!$.isArray(v))
				v = (typeof(v) != 'undefined') ? v.toString().split(/\s+/) : [ ];

			return v;
		},

		formvalue: function(sid)
		{
			var rv = [ ];
			var fields = $('#' + this.id(sid) + ' > input');

			for (var i = 0; i < fields.length; i++)
				if (typeof(fields[i].value) == 'string' && fields[i].value.length)
					rv.push(fields[i].value);

			return rv;
		}
	});

	this.cbi.DummyValue = AbstractValue.extend({
		widget: function(sid)
		{
			return $('<div />')
				.addClass('cbi-value-dummy')
				.attr('id', this.id(sid))
				.html(this.ucivalue(sid));
		},

		formvalue: function(sid)
		{
			return this.ucivalue(sid);
		}
	});

	this.cbi.NetworkList = AbstractValue.extend({
		load: function(sid)
		{
			var self = this;

			if (!self.interfaces)
			{
				self.interfaces = [ ];
				return _luci2.network.getNetworkStatus(function(ifaces) {
					self.interfaces = ifaces;
					self = null;
				});
			}

			return undefined;
		},

		_device_icon: function(dev)
		{
			var type = 'ethernet';
			var desc = _luci2.tr('Ethernet device');

			if (dev.type == 'IP tunnel')
			{
				type = 'tunnel';
				desc = _luci2.tr('Tunnel interface');
			}
			else if (dev['bridge-members'])
			{
				type = 'bridge';
				desc = _luci2.tr('Bridge');
			}
			else if (dev.wireless)
			{
				type = 'wifi';
				desc = _luci2.tr('Wireless Network');
			}
			else if (dev.name.indexOf('.') > 0)
			{
				type = 'vlan';
				desc = _luci2.tr('VLAN interface');
			}

			return $('<img />')
				.attr('src', _luci2.globals.resource + '/icons/' + type + (dev.up ? '' : '_disabled') + '.png')
				.attr('title', '%s (%s)'.format(desc, dev.name));
		},

		widget: function(sid)
		{
			var id = this.id(sid);
			var ul = $('<ul />')
				.attr('id', id)
				.addClass('cbi-input-networks');

			var itype = this.options.multiple ? 'checkbox' : 'radio';
			var value = this.ucivalue(sid);
			var check = { };

			if (!this.options.multiple)
				check[value] = true;
			else
				for (var i = 0; i < value.length; i++)
					check[value[i]] = true;

			if (this.interfaces)
			{
				for (var i = 0; i < this.interfaces.length; i++)
				{
					var iface = this.interfaces[i];
					var badge = $('<span />')
						.addClass('ifacebadge')
						.text('%s: '.format(iface.name));

					if (iface.subdevices)
						for (var j = 0; j < iface.subdevices.length; j++)
							badge.append(this._device_icon(iface.subdevices[j]));
					else if (iface.device)
						badge.append(this._device_icon(iface.device));
					else
						badge.append($('<em />').text(_luci2.tr('(No devices attached)')));

					$('<li />')
						.append($('<label />')
							.append($('<input />')
								.attr('name', itype + id)
								.attr('type', itype)
								.attr('value', iface.name)
								.prop('checked', !!check[iface.name])
								.addClass('cbi-input-' + itype))
							.append(badge))
						.appendTo(ul);
				}
			}

			if (!this.options.multiple)
			{
				$('<li />')
					.append($('<label />')
						.append($('<input />')
							.attr('name', itype + id)
							.attr('type', itype)
							.attr('value', '')
							.prop('checked', !value)
							.addClass('cbi-input-' + itype))
						.append(_luci2.tr('unspecified')))
					.appendTo(ul);
			}

			return ul;
		},

		ucivalue: function(sid)
		{
			var v = this.callSuper('ucivalue', sid);

			if (!this.options.multiple)
			{
				if ($.isArray(v))
				{
					return v[0];
				}
				else if (typeof(v) == 'string')
				{
					v = v.match(/\S+/);
					return v ? v[0] : undefined;
				}

				return v;
			}
			else
			{
				if (typeof(v) == 'string')
					v = v.match(/\S+/g);

				return v || [ ];
			}
		},

		formvalue: function(sid)
		{
			var inputs = $('#' + this.id(sid) + ' input');

			if (!this.options.multiple)
			{
				for (var i = 0; i < inputs.length; i++)
					if (inputs[i].checked && inputs[i].value !== '')
						return inputs[i].value;

				return undefined;
			}

			var rv = [ ];

			for (var i = 0; i < inputs.length; i++)
				if (inputs[i].checked)
					rv.push(inputs[i].value);

			return rv.length ? rv : undefined;
		}
	});


	var AbstractSection = AbstractWidget.extend({
		id: function()
		{
			var s = [ arguments[0], this.map.uci_package, this.uci_type ];

			for (var i = 1; i < arguments.length; i++)
				s.push(arguments[i].replace(/\./g, '_'));

			return s.join('_');
		},

		option: function(widget, name, options)
		{
			if (this.tabs.length == 0)
				this.tab({ id: '__default__', selected: true });

			return this.taboption('__default__', widget, name, options);
		},

		tab: function(options)
		{
			if (options.selected)
				this.tabs.selected = this.tabs.length;

			this.tabs.push({
				id:          options.id,
				caption:     options.caption,
				description: options.description,
				fields:      [ ],
				li:          { }
			});
		},

		taboption: function(tabid, widget, name, options)
		{
			var tab;
			for (var i = 0; i < this.tabs.length; i++)
			{
				if (this.tabs[i].id == tabid)
				{
					tab = this.tabs[i];
					break;
				}
			}

			if (!tab)
				throw 'Cannot append to unknown tab ' + tabid;

			var w = widget ? new widget(name, options) : null;

			if (!(w instanceof AbstractValue))
				throw 'Widget must be an instance of AbstractValue';

			w.section = this;
			w.map     = this.map;

			this.fields[name] = w;
			tab.fields.push(w);

			return w;
		},

		ucipackages: function(pkg)
		{
			for (var i = 0; i < this.tabs.length; i++)
				for (var j = 0; j < this.tabs[i].fields.length; j++)
					if (this.tabs[i].fields[j].options.uci_package)
						pkg[this.tabs[i].fields[j].options.uci_package] = true;
		},

		formvalue: function()
		{
			var rv = { };

			this.sections(function(s) {
				var sid = s['.name'];
				var sv = rv[sid] || (rv[sid] = { });

				for (var i = 0; i < this.tabs.length; i++)
					for (var j = 0; j < this.tabs[i].fields.length; j++)
					{
						var val = this.tabs[i].fields[j].formvalue(sid);
						sv[this.tabs[i].fields[j].name] = val;
					}
			});

			return rv;
		},

		validate: function(sid)
		{
			var rv = true;

			if (!sid)
			{
				var as = this.sections();
				for (var i = 0; i < as.length; i++)
					if (!this.validate(as[i]['.name']))
						rv = false;
				return rv;
			}

			var inst = this.instance[sid];
			var sv = rv[sid] || (rv[sid] = { });

			var invals = 0;
			var legend = $('#' + this.id('sort', sid)).find('legend:first');

			legend.children('span').detach();

			for (var i = 0; i < this.tabs.length; i++)
			{
				var inval = 0;
				var tab = $('#' + this.id('tabhead', sid, this.tabs[i].id));

				tab.children('span').detach();

				for (var j = 0; j < this.tabs[i].fields.length; j++)
					if (!this.tabs[i].fields[j].validate(sid))
						inval++;

				if (inval > 0)
				{
					$('<span />')
						.addClass('badge')
						.attr('title', _luci2.tr('%d Errors'.format(inval)))
						.text(inval)
						.appendTo(tab);

					invals += inval;
					tab = null;
					rv = false;
				}
			}

			if (invals > 0)
				$('<span />')
					.addClass('badge')
					.attr('title', _luci2.tr('%d Errors'.format(invals)))
					.text(invals)
					.appendTo(legend);

			return rv;
		}
	});

	this.cbi.TypedSection = AbstractSection.extend({
		init: function(uci_type, options)
		{
			this.uci_type = uci_type;
			this.options  = options;
			this.tabs     = [ ];
			this.fields   = { };
			this.active_panel = 0;
			this.active_tab   = { };
		},

		filter: function(section)
		{
			return true;
		},

		sections: function(cb)
		{
			var s1 = this.map.ucisections(this.map.uci_package);
			var s2 = [ ];

			for (var i = 0; i < s1.length; i++)
				if (s1[i]['.type'] == this.uci_type)
					if (this.filter(s1[i]))
						s2.push(s1[i]);

			if (typeof(cb) == 'function')
				for (var i = 0; i < s2.length; i++)
					cb.apply(this, [ s2[i] ]);

			return s2;
		},

		add: function(name)
		{
			this.map.add(this.map.uci_package, this.uci_type, name);
		},

		remove: function(sid)
		{
			this.map.remove(this.map.uci_package, sid);
		},

		_add: function(ev)
		{
			var addb = $(this);
			var name = undefined;
			var self = ev.data.self;

			if (addb.prev().prop('nodeName') == 'INPUT')
				name = addb.prev().val();

			if (addb.prop('disabled') || name === '')
				return;

			self.active_panel = -1;
			self.map.save();
			self.add(name);
			self.map.redraw();
		},

		_remove: function(ev)
		{
			var self = ev.data.self;
			var sid  = ev.data.sid;

			self.map.save();
			self.remove(sid);
			self.map.redraw();

			ev.stopPropagation();
		},

		_sid: function(ev)
		{
			var self = ev.data.self;
			var text = $(this);
			var addb = text.next();
			var errt = addb.next();
			var name = text.val();
			var used = false;

			if (!/^[a-zA-Z0-9_]*$/.test(name))
			{
				errt.text(_luci2.tr('Invalid section name')).show();
				text.addClass('error');
				addb.prop('disabled', true);
				return false;
			}

			for (var sid in self.map.uci.values[self.map.uci_package])
				if (sid == name)
				{
					used = true;
					break;
				}

			for (var sid in self.map.uci.creates[self.map.uci_package])
				if (sid == name)
				{
					used = true;
					break;
				}

			if (used)
			{
				errt.text(_luci2.tr('Name already used')).show();
				text.addClass('error');
				addb.prop('disabled', true);
				return false;
			}

			errt.text('').hide();
			text.removeClass('error');
			addb.prop('disabled', false);
			return true;
		},

		teaser: function(sid)
		{
			var tf = this.teaser_fields;

			if (!tf)
			{
				tf = this.teaser_fields = [ ];

				if ($.isArray(this.options.teasers))
				{
					for (var i = 0; i < this.options.teasers.length; i++)
					{
						var f = this.options.teasers[i];
						if (f instanceof AbstractValue)
							tf.push(f);
						else if (typeof(f) == 'string' && this.fields[f] instanceof AbstractValue)
							tf.push(this.fields[f]);
					}
				}
				else
				{
					for (var i = 0; tf.length <= 5 && i < this.tabs.length; i++)
						for (var j = 0; tf.length <= 5 && j < this.tabs[i].fields.length; j++)
							tf.push(this.tabs[i].fields[j]);
				}
			}

			var t = '';

			for (var i = 0; i < tf.length; i++)
			{
				if (tf[i].instance[sid] && tf[i].instance[sid].disabled)
					continue;

				var n = tf[i].options.caption || tf[i].name;
				var v = tf[i].textvalue(sid);

				if (typeof(v) == 'undefined')
					continue;

				t = t + '%s%s: <strong>%s</strong>'.format(t ? ' | ' : '', n, v);
			}

			return t;
		},

		_render_add: function()
		{
			var text = _luci2.tr('Add section');
			var ttip = _luci2.tr('Create new section...');

			if ($.isArray(this.options.add_caption))
				text = this.options.add_caption[0], ttip = this.options.add_caption[1];
			else if (typeof(this.options.add_caption) == 'string')
				text = this.options.add_caption, ttip = '';

			var add = $('<div />').addClass('cbi-section-add');

			if (this.options.anonymous === false)
			{
				$('<input />')
					.addClass('cbi-input-text')
					.attr('type', 'text')
					.attr('placeholder', ttip)
					.blur({ self: this }, this._sid)
					.keyup({ self: this }, this._sid)
					.appendTo(add);

				$('<img />')
					.attr('src', _luci2.globals.resource + '/icons/cbi/add.gif')
					.attr('title', text)
					.addClass('cbi-button')
					.click({ self: this }, this._add)
					.appendTo(add);

				$('<div />')
					.addClass('cbi-value-error')
					.hide()
					.appendTo(add);
			}
			else
			{
				$('<input />')
					.attr('type', 'button')
					.addClass('cbi-button')
					.addClass('cbi-button-add')
					.val(text).attr('title', ttip)
					.click({ self: this }, this._add)
					.appendTo(add)
			}

			return add;
		},

		_render_remove: function(sid)
		{
			var text = _luci2.tr('Remove');
			var ttip = _luci2.tr('Remove this section');

			if ($.isArray(this.options.remove_caption))
				text = this.options.remove_caption[0], ttip = this.options.remove_caption[1];
			else if (typeof(this.options.remove_caption) == 'string')
				text = this.options.remove_caption, ttip = '';

			return $('<input />')
				.attr('type', 'button')
				.addClass('cbi-button')
				.addClass('cbi-button-remove')
				.val(text).attr('title', ttip)
				.click({ self: this, sid: sid }, this._remove);
		},

		_render_caption: function(sid)
		{
			if (typeof(this.options.caption) == 'string')
			{
				return $('<legend />')
					.text(this.options.caption.format(sid));
			}
			else if (typeof(this.options.caption) == 'function')
			{
				return $('<legend />')
					.text(this.options.caption.call(this, sid));
			}

			return '';
		},

		render: function()
		{
			var allsections = $();
			var panel_index = 0;

			this.instance = { };

			var s = this.sections();

			if (s.length == 0)
			{
				var fieldset = $('<fieldset />')
					.addClass('cbi-section');

				var head = $('<div />')
					.addClass('cbi-section-head')
					.appendTo(fieldset);

				head.append(this._render_caption(undefined));

				if (typeof(this.options.description) == 'string')
				{
					$('<div />')
						.addClass('cbi-section-descr')
						.text(this.options.description)
						.appendTo(head);
				}

				allsections = allsections.add(fieldset);
			}

			for (var i = 0; i < s.length; i++)
			{
				var sid = s[i]['.name'];
				var inst = this.instance[sid] = { tabs: [ ] };

				var fieldset = $('<fieldset />')
					.attr('id', this.id('sort', sid))
					.addClass('cbi-section');

				var head = $('<div />')
					.addClass('cbi-section-head')
					.attr('cbi-section-num', this.index)
					.attr('cbi-section-id', sid);

				head.append(this._render_caption(sid));

				if (typeof(this.options.description) == 'string')
				{
					$('<div />')
						.addClass('cbi-section-descr')
						.text(this.options.description)
						.appendTo(head);
				}

				var teaser;
				if ((s.length > 1 && this.options.collabsible) || this.map.options.collabsible)
					teaser = $('<div />')
						.addClass('cbi-section-teaser')
						.appendTo(head);

				if (this.options.addremove)
					$('<div />')
						.addClass('cbi-section-remove')
						.addClass('right')
						.append(this._render_remove(sid))
						.appendTo(head);

				var body = $('<div />')
					.attr('index', panel_index++);

				var fields = $('<fieldset />')
					.addClass('cbi-section-node');

				if (this.tabs.length > 1)
				{
					var menu = $('<ul />')
						.addClass('cbi-tabmenu');

					for (var j = 0; j < this.tabs.length; j++)
					{
						var tabid = this.id('tab', sid, this.tabs[j].id);
						var theadid = this.id('tabhead', sid, this.tabs[j].id);

						var tabc = $('<div />')
							.addClass('cbi-tabcontainer')
							.attr('id', tabid)
							.attr('index', j);

						if (typeof(this.tabs[j].description) == 'string')
						{
							$('<div />')
								.addClass('cbi-tab-descr')
								.text(this.tabs[j].description)
								.appendTo(tabc);
						}

						for (var k = 0; k < this.tabs[j].fields.length; k++)
							this.tabs[j].fields[k].render(sid).appendTo(tabc);

						tabc.appendTo(fields);
						tabc = null;

						$('<li />').attr('id', theadid).append(
							$('<a />')
								.text(this.tabs[j].caption.format(this.tabs[j].id))
								.attr('href', '#' + tabid)
						).appendTo(menu);
					}

					menu.appendTo(body);
					menu = null;

					fields.appendTo(body);
					fields = null;

					var t = body.tabs({ active: this.active_tab[sid] });

					t.on('tabsactivate', { self: this, sid: sid }, function(ev, ui) {
						var d = ev.data;
						d.self.validate();
						d.self.active_tab[d.sid] = parseInt(ui.newPanel.attr('index'));
					});
				}
				else
				{
					for (var j = 0; j < this.tabs[0].fields.length; j++)
						this.tabs[0].fields[j].render(sid).appendTo(fields);

					fields.appendTo(body);
					fields = null;
				}

				head.appendTo(fieldset);
				head = null;

				body.appendTo(fieldset);
				body = null;

				allsections = allsections.add(fieldset);
				fieldset = null;

				//this.validate(sid);
				//
				//if (teaser)
				//	teaser.append(this.teaser(sid));
			}

			if (this.options.collabsible && s.length > 1)
			{
				var a = $('<div />').append(allsections).accordion({
					header: '> fieldset > div.cbi-section-head',
					heightStyle: 'content',
					active: this.active_panel
				});

				a.on('accordionbeforeactivate', { self: this }, function(ev, ui) {
					var h = ui.oldHeader;
					var s = ev.data.self;
					var i = h.attr('cbi-section-id');

					h.children('.cbi-section-teaser').empty().append(s.teaser(i));
					s.validate();
				});

				a.on('accordionactivate', { self: this }, function(ev, ui) {
					ev.data.self.active_panel = parseInt(ui.newPanel.attr('index'));
				});

				if (this.options.sortable)
				{
					var s = a.sortable({
						axis: 'y',
						handle: 'div.cbi-section-head'
					});

					s.on('sortupdate', { self: this, ids: s.sortable('toArray') }, function(ev, ui) {
						var sections = [ ];
						for (var i = 0; i < ev.data.ids.length; i++)
							sections.push(ev.data.ids[i].substring(ev.data.ids[i].lastIndexOf('.') + 1));
						_luci2.uci.order(ev.data.self.map.uci_package, sections);
					});

					s.on('sortstop', function(ev, ui) {
						ui.item.children('div.cbi-section-head').triggerHandler('focusout');
					});
				}

				if (this.options.addremove)
					this._render_add().appendTo(a);

				return a;
			}

			if (this.options.addremove)
				allsections = allsections.add(this._render_add());

			return allsections;
		},

		finish: function()
		{
			var s = this.sections();

			for (var i = 0; i < s.length; i++)
			{
				var sid = s[i]['.name'];

				this.validate(sid);

				$('#' + this.id('sort', sid))
					.children('.cbi-section-head')
					.children('.cbi-section-teaser')
					.append(this.teaser(sid));
			}
		}
	});

	this.cbi.TableSection = this.cbi.TypedSection.extend({
		render: function()
		{
			var allsections = $();
			var panel_index = 0;

			this.instance = { };

			var s = this.sections();

			var fieldset = $('<fieldset />')
				.addClass('cbi-section');

			fieldset.append(this._render_caption(sid));

			if (typeof(this.options.description) == 'string')
			{
				$('<div />')
					.addClass('cbi-section-descr')
					.text(this.options.description)
					.appendTo(fieldset);
			}

			var fields = $('<div />')
				.addClass('cbi-section-node')
				.appendTo(fieldset);

			var table = $('<table />')
				.addClass('cbi-section-table')
				.appendTo(fields);

			var thead = $('<thead />')
				.append($('<tr />').addClass('cbi-section-table-titles'))
				.appendTo(table);

			for (var j = 0; j < this.tabs[0].fields.length; j++)
				$('<th />')
					.addClass('cbi-section-table-cell')
					.css('width', this.tabs[0].fields[j].options.width || '')
					.append(this.tabs[0].fields[j].options.caption)
					.appendTo(thead.children());

			if (this.options.sortable)
				$('<th />').addClass('cbi-section-table-cell').text(' ').appendTo(thead.children());

			if (this.options.addremove !== false)
				$('<th />').addClass('cbi-section-table-cell').text(' ').appendTo(thead.children());

			var tbody = $('<tbody />')
				.appendTo(table);

			if (s.length == 0)
			{
				$('<tr />')
					.addClass('cbi-section-table-row')
					.append(
						$('<td />')
							.addClass('cbi-section-table-cell')
							.addClass('cbi-section-table-placeholder')
							.attr('colspan', thead.children().children().length)
							.text(this.options.placeholder || _luci2.tr('This section contains no values yet')))
					.appendTo(tbody);
			}

			for (var i = 0; i < s.length; i++)
			{
				var sid = s[i]['.name'];
				var inst = this.instance[sid] = { tabs: [ ] };

				var row = $('<tr />')
					.addClass('cbi-section-table-row')
					.appendTo(tbody);

				for (var j = 0; j < this.tabs[0].fields.length; j++)
				{
					$('<td />')
						.addClass('cbi-section-table-cell')
						.css('width', this.tabs[0].fields[j].options.width || '')
						.append(this.tabs[0].fields[j].render(sid, true))
						.appendTo(row);
				}

				if (this.options.sortable)
				{
					$('<td />')
						.addClass('cbi-section-table-cell')
						.addClass('cbi-section-table-sort')
						.append($('<img />').attr('src', _luci2.globals.resource + '/icons/cbi/up.gif').attr('title', _luci2.tr('Drag to sort')))
						.append($('<br />'))
						.append($('<img />').attr('src', _luci2.globals.resource + '/icons/cbi/down.gif').attr('title', _luci2.tr('Drag to sort')))
						.appendTo(row);
				}

				if (this.options.addremove !== false)
				{
					$('<td />')
						.addClass('cbi-section-table-cell')
						.append(this._render_remove(sid))
						.appendTo(row);
				}

				this.validate(sid);

				row = null;
			}

			if (this.options.sortable)
			{
				var s = tbody.sortable({
					handle: 'td.cbi-section-table-sort'
				});

				s.on('sortupdate', { self: this, ids: s.sortable('toArray') }, function(ev, ui) {
					var sections = [ ];
					for (var i = 0; i < ev.data.ids.length; i++)
						sections.push(ev.data.ids[i].substring(ev.data.ids[i].lastIndexOf('.') + 1));
					_luci2.uci.order(ev.data.self.map.uci_package, sections);
				});

				s.on('sortstop', function(ev, ui) {
					ui.item.children('div.cbi-section-head').triggerHandler('focusout');
				});
			}

			if (this.options.addremove)
				this._render_add().appendTo(fieldset);

			fields = table = thead = tbody = null;

			return fieldset;
		}
	});

	this.cbi.NamedSection = this.cbi.TypedSection.extend({
		sections: function(cb)
		{
			var sa = [ ];
			var pkg = this.map.uci.values[this.map.uci_package];

			for (var s in pkg)
				if (pkg[s]['.name'] == this.uci_type)
				{
					sa.push(pkg[s]);
					break;
				}

			if (typeof(cb) == 'function' && sa.length > 0)
				cb.apply(this, [ sa[0] ]);

			return sa;
		}
	});

	this.cbi.DummySection = this.cbi.TypedSection.extend({
		sections: function(cb)
		{
			if (typeof(cb) == 'function')
				cb.apply(this, [ { '.name': this.uci_type } ]);

			return [ { '.name': this.uci_type } ];
		}
	});

	this.cbi.Map = AbstractWidget.extend({
		init: function(uci_package, options)
		{
			var self = this;

			this.uci_package = uci_package;
			this.sections = [ ];
			this.options = _luci2.defaults(options, {
				save:    function() { },
				prepare: function() {
					return _luci2.uci.writable(function(writable) {
						self.options.readonly = !writable;
					});
				}
			});
		},

		load: function()
		{
			this.uci = {
				newid:   0,
				values:  { },
				creates: { },
				changes: { },
				deletes: { }
			};

			this.active_panel = 0;

			var packages = { };

			for (var i = 0; i < this.sections.length; i++)
				this.sections[i].ucipackages(packages);

			packages[this.uci_package] = true;

			for (var p in packages)
				packages[p] = ['uci', 'get', { config: p }];

			var load_cb = this._load_cb || (this._load_cb = $.proxy(function(responses) {
				for (var p in responses)
				{
					if (responses[p][0] != 0 || !responses[p][1] || !responses[p][1].values)
						continue;

					this.uci.values[p] = responses[p][1].values;
				}

				var deferreds = [ _luci2.deferrable(this.options.prepare()) ];

				for (var i = 0; i < this.sections.length; i++)
				{
					for (var f in this.sections[i].fields)
					{
						if (typeof(this.sections[i].fields[f].load) != 'function')
							continue;

						var s = this.sections[i].sections();
						for (var j = 0; j < s.length; j++)
						{
							var rv = this.sections[i].fields[f].load(s[j]['.name']);
							if (_luci2.deferred(rv))
								deferreds.push(rv);
						}
					}
				}

				return $.when.apply($, deferreds);
			}, this));

			return _luci2.rpc.call(packages).then(load_cb);
		},

		render: function()
		{
			var map = $('<div />').addClass('cbi-map');

			if (typeof(this.options.caption) == 'string')
				$('<h2 />').text(this.options.caption).appendTo(map);

			if (typeof(this.options.description) == 'string')
				$('<div />').addClass('cbi-map-descr').text(this.options.description).appendTo(map);

			var sections = $('<div />').appendTo(map);

			for (var i = 0; i < this.sections.length; i++)
			{
				var s = this.sections[i].render();

				if (this.options.readonly || this.sections[i].options.readonly)
					s.find('input, select, button, img.cbi-button').attr('disabled', true);

				s.appendTo(sections);

				if (this.sections[i].options.active)
					this.active_panel = i;
			}

			if (this.options.collabsible)
			{
				var a = sections.accordion({
					header: '> fieldset > div.cbi-section-head',
					heightStyle: 'content',
					active: this.active_panel
				});

				a.on('accordionbeforeactivate', { self: this }, function(ev, ui) {
					var h = ui.oldHeader;
					var s = ev.data.self.sections[parseInt(h.attr('cbi-section-num'))];
					var i = h.attr('cbi-section-id');

					h.children('.cbi-section-teaser').empty().append(s.teaser(i));

					for (var i = 0; i < ev.data.self.sections.length; i++)
						ev.data.self.sections[i].validate();
				});

				a.on('accordionactivate', { self: this }, function(ev, ui) {
					ev.data.self.active_panel = parseInt(ui.newPanel.attr('index'));
				});
			}

			if (this.options.pageaction !== false)
			{
				var a = $('<div />')
					.addClass('cbi-page-actions')
					.appendTo(map);

				$('<input />')
					.addClass('cbi-button').addClass('cbi-button-apply')
					.attr('type', 'button')
					.val(_luci2.tr('Save & Apply'))
					.appendTo(a);

				$('<input />')
					.addClass('cbi-button').addClass('cbi-button-save')
					.attr('type', 'button')
					.val(_luci2.tr('Save'))
					.click({ self: this }, function(ev) { ev.data.self.send(); })
					.appendTo(a);

				$('<input />')
					.addClass('cbi-button').addClass('cbi-button-reset')
					.attr('type', 'button')
					.val(_luci2.tr('Reset'))
					.click({ self: this }, function(ev) { ev.data.self.insertInto(ev.data.self.target); })
					.appendTo(a);

				a = null;
			}

			var top = $('<form />').append(map);

			map = null;

			return top;
		},

		finish: function()
		{
			for (var i = 0; i < this.sections.length; i++)
				this.sections[i].finish();

			this.validate();
		},

		redraw: function()
		{
			this.target.hide().empty().append(this.render());
			this.finish();
			this.target.show();
		},

		section: function(widget, uci_type, options)
		{
			var w = widget ? new widget(uci_type, options) : null;

			if (!(w instanceof AbstractSection))
				throw 'Widget must be an instance of AbstractSection';

			w.map = this;
			w.index = this.sections.length;

			this.sections.push(w);
			return w;
		},

		formvalue: function()
		{
			var rv = { };

			for (var i = 0; i < this.sections.length; i++)
			{
				var sids = this.sections[i].formvalue();
				for (var sid in sids)
				{
					var s = rv[sid] || (rv[sid] = { });
					$.extend(s, sids[sid]);
				}
			}

			return rv;
		},

		add: function(conf, type, name)
		{
			var c = this.uci.creates;
			var s = '.new.%d'.format(this.uci.newid++);

			if (!c[conf])
				c[conf] = { };

			c[conf][s] = {
				'.type':      type,
				'.name':      s,
				'.create':    name,
				'.anonymous': !name
			};

			return s;
		},

		remove: function(conf, sid)
		{
			var n = this.uci.creates;
			var c = this.uci.changes;
			var d = this.uci.deletes;

			/* requested deletion of a just created section */
			if (sid.indexOf('.new.') == 0)
			{
				if (n[conf])
					delete n[conf][sid];
			}
			else
			{
				if (c[conf])
					delete c[conf][sid];

				if (!d[conf])
					d[conf] = { };

				d[conf][sid] = true;
			}
		},

		ucisections: function(conf, cb)
		{
			var sa = [ ];
			var pkg = this.uci.values[conf];
			var crt = this.uci.creates[conf];
			var del = this.uci.deletes[conf];

			if (!pkg)
				return sa;

			for (var s in pkg)
				if (!del || del[s] !== true)
					sa.push(pkg[s]);

			sa.sort(function(a, b) { return a['.index'] - b['.index'] });

			if (crt)
				for (var s in crt)
					sa.push(crt[s]);

			if (typeof(cb) == 'function')
				for (var i = 0; i < sa.length; i++)
					cb.apply(this, [ sa[i] ]);

			return sa;
		},

		get: function(conf, sid, opt)
		{
			var v = this.uci.values;
			var n = this.uci.creates;
			var c = this.uci.changes;
			var d = this.uci.deletes;

			/* requested option in a just created section */
			if (sid.indexOf('.new.') == 0)
			{
				if (!n[conf])
					return undefined;

				if (typeof(opt) == 'undefined')
					return (n[conf][sid] || { });

				return n[conf][sid][opt];
			}

			/* requested an option value */
			if (typeof(opt) != 'undefined')
			{
				/* check whether option was deleted */
				if (d[conf] && d[conf][sid])
				{
					if (d[conf][sid] === true)
						return undefined;

					for (var i = 0; i < d[conf][sid].length; i++)
						if (d[conf][sid][i] == opt)
							return undefined;
				}

				/* check whether option was changed */
				if (c[conf] && c[conf][sid] && typeof(c[conf][sid][opt]) != 'undefined')
					return c[conf][sid][opt];

				/* return base value */
				if (v[conf] && v[conf][sid])
					return v[conf][sid][opt];

				return undefined;
			}

			/* requested an entire section */
			if (v[conf])
				return (v[conf][sid] || { });

			return undefined;
		},

		set: function(conf, sid, opt, val)
		{
			var n = this.uci.creates;
			var c = this.uci.changes;
			var d = this.uci.deletes;

			if (sid.indexOf('.new.') == 0)
			{
				if (n[conf] && n[conf][sid])
				{
					if (typeof(val) != 'undefined')
						n[conf][sid][opt] = val;
					else
						delete n[conf][sid][opt];
				}
			}
			else if (typeof(val) != 'undefined')
			{
				if (!c[conf])
					c[conf] = { };

				if (!c[conf][sid])
					c[conf][sid] = { };

				c[conf][sid][opt] = val;
			}
			else
			{
				if (!d[conf])
					d[conf] = { };

				if (!d[conf][sid])
					d[conf][sid] = [ ];

				d[conf][sid].push(opt);
			}
		},

		validate: function()
		{
			var rv = true;

			for (var i = 0; i < this.sections.length; i++)
				if (!this.sections[i].validate())
					rv = false;

			return rv;
		},

		save: function()
		{
			if (this.options.readonly)
				return _luci2.deferrable();

			var deferreds = [ _luci2.deferrable(this.options.save()) ];

			for (var i = 0; i < this.sections.length; i++)
			{
				if (this.sections[i].options.readonly)
					continue;

				for (var f in this.sections[i].fields)
				{
					if (typeof(this.sections[i].fields[f].save) != 'function')
						continue;

					var s = this.sections[i].sections();
					for (var j = 0; j < s.length; j++)
					{
						var rv = this.sections[i].fields[f].save(s[j]['.name']);
						if (_luci2.deferred(rv))
							deferreds.push(rv);
					}
				}
			}

			return $.when.apply($, deferreds);
		},

		send: function()
		{
			if (!this.validate())
				return _luci2.deferrable();

			var send_cb = this._send_cb || (this._send_cb = $.proxy(function() {
				var requests = [ ];

				if (this.uci.creates)
					for (var c in this.uci.creates)
						for (var s in this.uci.creates[c])
						{
							var r = {
								config: c,
								values: { }
							};

							for (var k in this.uci.creates[c][s])
							{
								if (k == '.type')
									r.type = this.uci.creates[i][k];
								else if (k == '.create')
									r.name = this.uci.creates[i][k];
								else if (k.charAt(0) != '.')
									r.values[k] = this.uci.creates[i][k];
							}
							requests.push(['uci', 'add', r]);
						}

				if (this.uci.changes)
					for (var c in this.uci.changes)
						for (var s in this.uci.changes[c])
							requests.push(['uci', 'set', {
								config:  c,
								section: s,
								values:  this.uci.changes[c][s]
							}]);

				if (this.uci.deletes)
					for (var c in this.uci.deletes)
						for (var s in this.uci.deletes[c])
						{
							var o = this.uci.deletes[c][s];
							requests.push(['uci', 'delete', {
								config:  c,
								section: s,
								options: (o === true) ? undefined : o
							}]);
						}

				return _luci2.rpc.call(requests);
			}, this));

			var self = this;

			_luci2.ui.loading(true);

			return this.save().then(send_cb).then(function() {
				return self.load();
			}).then(function() {
				self.redraw();
				self = null;

				_luci2.ui.loading(false);
			});
		},

		dialog: function(id)
		{
			var d = $('<div />');
			var p = $('<p />');

			$('<img />')
				.attr('src', _luci2.globals.resource + '/icons/loading.gif')
				.css('vertical-align', 'middle')
				.css('padding-right', '10px')
				.appendTo(p);

			p.append(_luci2.tr('Loading data...'));

			p.appendTo(d);
			d.appendTo(id);

			return d.dialog({
				modal: true,
				draggable: false,
				resizable: false,
				height: 90,
				open: function() {
					$(this).parent().children('.ui-dialog-titlebar').hide();
				}
			});
		},

		insertInto: function(id)
		{
			var self = this;
			    self.target = $(id);

			_luci2.ui.loading(true);
			self.target.hide();

			return self.load().then(function() {
				self.target.empty().append(self.render());
				self.finish();
				self.target.show();
				self = null;
				_luci2.ui.loading(false);
			});
		}
	});
};
