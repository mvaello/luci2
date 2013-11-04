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

	this.isDeferred = function(x)
	{
		return (typeof(x) == 'object' &&
		        typeof(x.then) == 'function' &&
		        typeof(x.promise) == 'function');
	};

	this.deferrable = function()
	{
		if (this.isDeferred(arguments[0]))
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
		timeout:  15000,
		resource: '/luci2',
		sid:      '00000000000000000000000000000000'
	};

	this.rpc = {

		_id: 1,
		_batch: undefined,
		_requests: { },

		_call: function(req, cb)
		{
			return $.ajax('/ubus', {
				cache:       false,
				contentType: 'application/json',
				data:        JSON.stringify(req),
				dataType:    'json',
				type:        'POST',
				timeout:     _luci2.globals.timeout
			}).then(cb);
		},

		_list_cb: function(msg)
		{
			/* verify message frame */
			if (typeof(msg) != 'object' || msg.jsonrpc != '2.0' || !msg.id)
				throw 'Invalid JSON response';

			return msg.result;
		},

		_call_cb: function(msg)
		{
			var data = [ ];
			var type = Object.prototype.toString;

			if (!$.isArray(msg))
				msg = [ msg ];

			for (var i = 0; i < msg.length; i++)
			{
				/* verify message frame */
				if (typeof(msg[i]) != 'object' || msg[i].jsonrpc != '2.0' || !msg[i].id)
					throw 'Invalid JSON response';

				/* fetch related request info */
				var req = _luci2.rpc._requests[msg[i].id];
				if (typeof(req) != 'object')
					throw 'No related request for JSON response';

				/* fetch response attribute and verify returned type */
				var ret = undefined;

				if ($.isArray(msg[i].result) && msg[i].result[0] == 0)
					ret = (msg[i].result.length > 1) ? msg[i].result[1] : msg[i].result[0];

				if (req.expect)
				{
					for (var key in req.expect)
					{
						if (typeof(ret) != 'undefined' && key != '')
							ret = ret[key];

						if (type.call(ret) != type.call(req.expect[key]))
							ret = req.expect[key];

						break;
					}
				}

				/* apply filter */
				if (typeof(req.filter) == 'function')
				{
					req.priv[0] = ret;
					req.priv[1] = req.params;
					ret = req.filter.apply(_luci2.rpc, req.priv);
				}

				/* store response data */
				if (typeof(req.index) == 'number')
					data[req.index] = ret;
				else
					data = ret;

				/* delete request object */
				delete _luci2.rpc._requests[msg[i].id];
			}

			return data;
		},

		list: function()
		{
			var params = [ ];
			for (var i = 0; i < arguments.length; i++)
				params[i] = arguments[i];

			var msg = {
				jsonrpc: '2.0',
				id:      this._id++,
				method:  'list',
				params:  (params.length > 0) ? params : undefined
			};

			return this._call(msg, this._list_cb);
		},

		batch: function()
		{
			if (!$.isArray(this._batch))
				this._batch = [ ];
		},

		flush: function()
		{
			if (!$.isArray(this._batch))
				return _luci2.deferrable([ ]);

			var req = this._batch;
			delete this._batch;

			/* call rpc */
			return this._call(req, this._call_cb);
		},

		declare: function(options)
		{
			var _rpc = this;

			return function() {
				/* build parameter object */
				var p_off = 0;
				var params = { };
				if ($.isArray(options.params))
					for (p_off = 0; p_off < options.params.length; p_off++)
						params[options.params[p_off]] = arguments[p_off];

				/* all remaining arguments are private args */
				var priv = [ undefined, undefined ];
				for (; p_off < arguments.length; p_off++)
					priv.push(arguments[p_off]);

				/* store request info */
				var req = _rpc._requests[_rpc._id] = {
					expect: options.expect,
					filter: options.filter,
					params: params,
					priv:   priv
				};

				/* build message object */
				var msg = {
					jsonrpc: '2.0',
					id:      _rpc._id++,
					method:  'call',
					params:  [
						_luci2.globals.sid,
						options.object,
						options.method,
						params
					]
				};

				/* when a batch is in progress then store index in request data
				 * and push message object onto the stack */
				if ($.isArray(_rpc._batch))
				{
					req.index = _rpc._batch.push(msg) - 1;
					return _luci2.deferrable(msg);
				}

				/* call rpc */
				return _rpc._call(msg, _rpc._call_cb);
			};
		}
	};

	this.uci = {

		writable: function()
		{
			return _luci2.session.access('ubus', 'uci', 'commit');
		},

		add: _luci2.rpc.declare({
			object: 'uci',
			method: 'add',
			params: [ 'config', 'type', 'name', 'values' ],
			expect: { section: '' }
		}),

		apply: function()
		{

		},

		configs: _luci2.rpc.declare({
			object: 'uci',
			method: 'configs',
			expect: { configs: [ ] }
		}),

		_changes: _luci2.rpc.declare({
			object: 'uci',
			method: 'changes',
			params: [ 'config' ],
			expect: { changes: [ ] }
		}),

		changes: function(config)
		{
			if (typeof(config) == 'string')
				return this._changes(config);

			var configlist;
			return this.configs().then(function(configs) {
				_luci2.rpc.batch();
				configlist = configs;

				for (var i = 0; i < configs.length; i++)
					_luci2.uci._changes(configs[i]);

				return _luci2.rpc.flush();
			}).then(function(changes) {
				var rv = { };

				for (var i = 0; i < configlist.length; i++)
					if (changes[i].length)
						rv[configlist[i]] = changes[i];

				return rv;
			});
		},

		commit: _luci2.rpc.declare({
			object: 'uci',
			method: 'commit',
			params: [ 'config' ]
		}),

		_delete_one: _luci2.rpc.declare({
			object: 'uci',
			method: 'delete',
			params: [ 'config', 'section', 'option' ]
		}),

		_delete_multiple: _luci2.rpc.declare({
			object: 'uci',
			method: 'delete',
			params: [ 'config', 'section', 'options' ]
		}),

		'delete': function(config, section, option)
		{
			if ($.isArray(option))
				return this._delete_multiple(config, section, option);
			else
				return this._delete_one(config, section, option);
		},

		delete_all: _luci2.rpc.declare({
			object: 'uci',
			method: 'delete',
			params: [ 'config', 'type', 'match' ]
		}),

		_foreach: _luci2.rpc.declare({
			object: 'uci',
			method: 'get',
			params: [ 'config', 'type' ],
			expect: { values: { } }
		}),

		foreach: function(config, type, cb)
		{
			return this._foreach(config, type).then(function(sections) {
				for (var s in sections)
					cb(sections[s]);
			});
		},

		get: _luci2.rpc.declare({
			object: 'uci',
			method: 'get',
			params: [ 'config', 'section', 'option' ],
			expect: { '': { } },
			filter: function(data, params) {
				if (typeof(params.option) == 'undefined')
					return data.values ? data.values['.type'] : undefined;
				else
					return data.value;
			}
		}),

		get_all: _luci2.rpc.declare({
			object: 'uci',
			method: 'get',
			params: [ 'config', 'section' ],
			expect: { values: { } },
			filter: function(data, params) {
				if (typeof(params.section) == 'string')
					data['.section'] = params.section;
				else if (typeof(params.config) == 'string')
					data['.package'] = params.config;
				return data;
			}
		}),

		get_first: function(config, type, option)
		{
			return this._foreach(config, type).then(function(sections) {
				for (var s in sections)
				{
					var val = (typeof(option) == 'string') ? sections[s][option] : sections[s]['.name'];

					if (typeof(val) != 'undefined')
						return val;
				}

				return undefined;
			});
		},

		section: _luci2.rpc.declare({
			object: 'uci',
			method: 'add',
			params: [ 'config', 'type', 'name', 'values' ],
			expect: { section: '' }
		}),

		_set: _luci2.rpc.declare({
			object: 'uci',
			method: 'set',
			params: [ 'config', 'section', 'values' ]
		}),

		set: function(config, section, option, value)
		{
			if (typeof(value) == 'undefined' && typeof(option) == 'string')
				return this.section(config, section, option); /* option -> type */
			else if ($.isPlainObject(option))
				return this._set(config, section, option); /* option -> values */

			var values = { };
			    values[option] = value;

			return this._set(config, section, values);
		},

		order: _luci2.rpc.declare({
			object: 'uci',
			method: 'order',
			params: [ 'config', 'sections' ]
		})
	};

	this.network = {
		listNetworkNames: function() {
			return _luci2.rpc.list('network.interface.*').then(function(list) {
				var names = [ ];
				for (var name in list)
					if (name != 'network.interface.loopback')
						names.push(name.substring(18));
				names.sort();
				return names;
			});
		},

		listDeviceNames: _luci2.rpc.declare({
			object: 'network.device',
			method: 'status',
			expect: { '': { } },
			filter: function(data) {
				var names = [ ];
				for (var name in data)
					if (name != 'lo')
						names.push(name);
				names.sort();
				return names;
			}
		}),

		getNetworkStatus: function()
		{
			var nets = [ ];
			var devs = { };

			return this.listNetworkNames().then(function(names) {
				_luci2.rpc.batch();

				for (var i = 0; i < names.length; i++)
					_luci2.network.getInterfaceStatus(names[i]);

				return _luci2.rpc.flush();
			}).then(function(networks) {
				for (var i = 0; i < networks.length; i++)
				{
					var net = nets[i] = networks[i];
					var dev = net.l3_device || net.l2_device;
					if (dev)
						net.device = devs[dev] || (devs[dev] = { });
				}

				_luci2.rpc.batch();

				for (var dev in devs)
					_luci2.network.getDeviceStatus(dev);

				return _luci2.rpc.flush();
			}).then(function(devices) {
				_luci2.rpc.batch();

				for (var i = 0; i < devices.length; i++)
				{
					var brm = devices[i]['bridge-members'];
					delete devices[i]['bridge-members'];

					$.extend(devs[devices[i]['device']], devices[i]);

					if (!brm)
						continue;

					devs[devices[i]['device']].subdevices = [ ];

					for (var j = 0; j < brm.length; j++)
					{
						if (!devs[brm[j]])
						{
							devs[brm[j]] = { };
							_luci2.network.getDeviceStatus(brm[j]);
						}

						devs[devices[i]['device']].subdevices[j] = devs[brm[j]];
					}
				}

				return _luci2.rpc.flush();
			}).then(function(subdevices) {
				for (var i = 0; i < subdevices.length; i++)
					$.extend(devs[subdevices[i]['device']], subdevices[i]);

				_luci2.rpc.batch();

				for (var dev in devs)
					_luci2.wireless.getDeviceStatus(dev);

				return _luci2.rpc.flush();
			}).then(function(wifidevices) {
				for (var i = 0; i < wifidevices.length; i++)
					if (wifidevices[i])
						devs[wifidevices[i]['device']].wireless = wifidevices[i];

				nets.sort(function(a, b) {
					if (a['interface'] < b['interface'])
						return -1;
					else if (a['interface'] > b['interface'])
						return 1;
					else
						return 0;
				});

				return nets;
			});
		},

		findWanInterfaces: function(cb)
		{
			return this.listNetworkNames().then(function(names) {
				_luci2.rpc.batch();

				for (var i = 0; i < names.length; i++)
					_luci2.network.getInterfaceStatus(names[i]);

				return _luci2.rpc.flush();
			}).then(function(interfaces) {
				var rv = [ undefined, undefined ];

				for (var i = 0; i < interfaces.length; i++)
				{
					if (!interfaces[i].route)
						continue;

					for (var j = 0; j < interfaces[i].route.length; j++)
					{
						var rt = interfaces[i].route[j];

						if (typeof(rt.table) != 'undefined')
							continue;

						if (rt.target == '0.0.0.0' && rt.mask == 0)
							rv[0] = interfaces[i];
						else if (rt.target == '::' && rt.mask == 0)
							rv[1] = interfaces[i];
					}
				}

				return rv;
			});
		},

		getDHCPLeases: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'dhcp_leases',
			expect: { leases: [ ] }
		}),

		getDHCPv6Leases: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'dhcp6_leases',
			expect: { leases: [ ] }
		}),

		getRoutes: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'routes',
			expect: { routes: [ ] }
		}),

		getIPv6Routes: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'routes',
			expect: { routes: [ ] }
		}),

		getARPTable: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'arp_table',
			expect: { entries: [ ] }
		}),

		getInterfaceStatus: _luci2.rpc.declare({
			object: 'network.interface',
			method: 'status',
			params: [ 'interface' ],
			expect: { '': { } },
			filter: function(data, params) {
				data['interface'] = params['interface'];
				data['l2_device'] = data['device'];
				delete data['device'];
				return data;
			}
		}),

		getDeviceStatus: _luci2.rpc.declare({
			object: 'network.device',
			method: 'status',
			params: [ 'name' ],
			expect: { '': { } },
			filter: function(data, params) {
				data['device'] = params['name'];
				return data;
			}
		}),

		getConntrackCount: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'conntrack_count',
			expect: { '': { count: 0, limit: 0 } }
		}),

		listSwitchNames: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'switch_list',
			expect: { switches: [ ] }
		}),

		getSwitchInfo: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'switch_info',
			params: [ 'switch' ],
			expect: { info: { } },
			filter: function(data, params) {
				data['attrs']      = data['switch'];
				data['vlan_attrs'] = data['vlan'];
				data['port_attrs'] = data['port'];
				data['switch']     = params['switch'];

				delete data.vlan;
				delete data.port;

				return data;
			}
		}),

		getSwitchStatus: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'switch_status',
			params: [ 'switch' ],
			expect: { ports: [ ] }
		}),


		runPing: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'ping',
			params: [ 'data' ],
			expect: { '': { code: -1 } }
		}),

		runPing6: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'ping6',
			params: [ 'data' ],
			expect: { '': { code: -1 } }
		}),

		runTraceroute: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'traceroute',
			params: [ 'data' ],
			expect: { '': { code: -1 } }
		}),

		runTraceroute6: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'traceroute6',
			params: [ 'data' ],
			expect: { '': { code: -1 } }
		}),

		runNslookup: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'nslookup',
			params: [ 'data' ],
			expect: { '': { code: -1 } }
		}),


		setUp: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'ifup',
			params: [ 'data' ],
			expect: { '': { code: -1 } }
		}),

		setDown: _luci2.rpc.declare({
			object: 'luci2.network',
			method: 'ifdown',
			params: [ 'data' ],
			expect: { '': { code: -1 } }
		})
	};

	this.wireless = {
		listDeviceNames: _luci2.rpc.declare({
			object: 'iwinfo',
			method: 'devices',
			expect: { 'devices': [ ] },
			filter: function(data) {
				data.sort();
				return data;
			}
		}),

		getDeviceStatus: _luci2.rpc.declare({
			object: 'iwinfo',
			method: 'info',
			params: [ 'device' ],
			expect: { '': { } },
			filter: function(data, params) {
				if (!$.isEmptyObject(data))
				{
					data['device'] = params['device'];
					return data;
				}
				return undefined;
			}
		}),

		getAssocList: _luci2.rpc.declare({
			object: 'iwinfo',
			method: 'assoclist',
			params: [ 'device' ],
			expect: { results: [ ] },
			filter: function(data, params) {
				for (var i = 0; i < data.length; i++)
					data[i]['device'] = params['device'];

				data.sort(function(a, b) {
					if (a.bssid < b.bssid)
						return -1;
					else if (a.bssid > b.bssid)
						return 1;
					else
						return 0;
				});

				return data;
			}
		}),

		getWirelessStatus: function() {
			return this.listDeviceNames().then(function(names) {
				_luci2.rpc.batch();

				for (var i = 0; i < names.length; i++)
					_luci2.wireless.getDeviceStatus(names[i]);

				return _luci2.rpc.flush();
			}).then(function(networks) {
				var rv = { };

				var phy_attrs = [
					'country', 'channel', 'frequency', 'frequency_offset',
					'txpower', 'txpower_offset', 'hwmodes', 'hardware', 'phy'
				];

				var net_attrs = [
					'ssid', 'bssid', 'mode', 'quality', 'quality_max',
					'signal', 'noise', 'bitrate', 'encryption'
				];

				for (var i = 0; i < networks.length; i++)
				{
					var phy = rv[networks[i].phy] || (
						rv[networks[i].phy] = { networks: [ ] }
					);

					var net = {
						device: networks[i].device
					};

					for (var j = 0; j < phy_attrs.length; j++)
						phy[phy_attrs[j]] = networks[i][phy_attrs[j]];

					for (var j = 0; j < net_attrs.length; j++)
						net[net_attrs[j]] = networks[i][net_attrs[j]];

					phy.networks.push(net);
				}

				return rv;
			});
		},

		getAssocLists: function()
		{
			return this.listDeviceNames().then(function(names) {
				_luci2.rpc.batch();

				for (var i = 0; i < names.length; i++)
					_luci2.wireless.getAssocList(names[i]);

				return _luci2.rpc.flush();
			}).then(function(assoclists) {
				var rv = [ ];

				for (var i = 0; i < assoclists.length; i++)
					for (var j = 0; j < assoclists[i].length; j++)
						rv.push(assoclists[i][j]);

				return rv;
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

	this.firewall = {
		getZoneColor: function(zone)
		{
			if ($.isPlainObject(zone))
				zone = zone.name;

			if (zone == 'lan')
				return '#90f090';
			else if (zone == 'wan')
				return '#f09090';

			for (var i = 0, hash = 0;
				 i < zone.length;
				 hash = zone.charCodeAt(i++) + ((hash << 5) - hash));

			for (var i = 0, color = '#';
				 i < 3;
				 color += ('00' + ((hash >> i++ * 8) & 0xFF).tozoneing(16)).slice(-2));

			return color;
		},

		findZoneByNetwork: function(network)
		{
			var self = this;
			var zone = undefined;

			return _luci2.uci.foreach('firewall', 'zone', function(z) {
				if (!z.name || !z.network)
					return;

				if (!$.isArray(z.network))
					z.network = z.network.split(/\s+/);

				for (var i = 0; i < z.network.length; i++)
				{
					if (z.network[i] == network)
					{
						zone = z;
						break;
					}
				}
			}).then(function() {
				if (zone)
					zone.color = self.getZoneColor(zone);

				return zone;
			});
		}
	};

	this.system = {
		getSystemInfo: _luci2.rpc.declare({
			object: 'system',
			method: 'info',
			expect: { '': { } }
		}),

		getBoardInfo: _luci2.rpc.declare({
			object: 'system',
			method: 'board',
			expect: { '': { } }
		}),

		getDiskInfo: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'diskfree',
			expect: { '': { } }
		}),

		getInfo: function(cb)
		{
			_luci2.rpc.batch();

			this.getSystemInfo();
			this.getBoardInfo();
			this.getDiskInfo();

			return _luci2.rpc.flush().then(function(info) {
				var rv = { };

				$.extend(rv, info[0]);
				$.extend(rv, info[1]);
				$.extend(rv, info[2]);

				return rv;
			});
		},

		getProcessList: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'process_list',
			expect: { processes: [ ] },
			filter: function(data) {
				data.sort(function(a, b) { return a.pid - b.pid });
				return data;
			}
		}),

		getSystemLog: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'syslog',
			expect: { log: '' }
		}),

		getKernelLog: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'dmesg',
			expect: { log: '' }
		}),

		getZoneInfo: function(cb)
		{
			return $.getJSON(_luci2.globals.resource + '/zoneinfo.json', cb);
		},

		sendSignal: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'process_signal',
			params: [ 'pid', 'signal' ],
			filter: function(data) {
				return (data == 0);
			}
		}),

		initList: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'init_list',
			expect: { initscripts: [ ] },
			filter: function(data) {
				data.sort(function(a, b) { return (a.start || 0) - (b.start || 0) });
				return data;
			}
		}),

		initEnabled: function(init, cb)
		{
			return this.initList().then(function(list) {
				for (var i = 0; i < list.length; i++)
					if (list[i].name == init)
						return !!list[i].enabled;

				return false;
			});
		},

		initRun: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'init_action',
			params: [ 'name', 'action' ],
			filter: function(data) {
				return (data == 0);
			}
		}),

		initStart:   function(init, cb) { return _luci2.system.initRun(init, 'start',   cb) },
		initStop:    function(init, cb) { return _luci2.system.initRun(init, 'stop',    cb) },
		initRestart: function(init, cb) { return _luci2.system.initRun(init, 'restart', cb) },
		initReload:  function(init, cb) { return _luci2.system.initRun(init, 'reload',  cb) },
		initEnable:  function(init, cb) { return _luci2.system.initRun(init, 'enable',  cb) },
		initDisable: function(init, cb) { return _luci2.system.initRun(init, 'disable', cb) },


		getRcLocal: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'rclocal_get',
			expect: { data: '' }
		}),

		setRcLocal: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'rclocal_set',
			params: [ 'data' ]
		}),


		getCrontab: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'crontab_get',
			expect: { data: '' }
		}),

		setCrontab: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'crontab_set',
			params: [ 'data' ]
		}),


		getSSHKeys: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'sshkeys_get',
			expect: { keys: [ ] }
		}),

		setSSHKeys: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'sshkeys_set',
			params: [ 'keys' ]
		}),


		setPassword: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'password_set',
			params: [ 'user', 'password' ]
		}),


		listLEDs: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'led_list',
			expect: { leds: [ ] }
		}),

		listUSBDevices: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'usb_list',
			expect: { devices: [ ] }
		}),


		testUpgrade: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'upgrade_test',
			expect: { '': { } }
		}),

		startUpgrade: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'upgrade_start',
			params: [ 'keep' ]
		}),

		cleanUpgrade: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'upgrade_clean'
		}),


		restoreBackup: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'backup_restore'
		}),

		cleanBackup: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'backup_clean'
		}),


		getBackupConfig: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'backup_config_get',
			expect: { config: '' }
		}),

		setBackupConfig: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'backup_config_set',
			params: [ 'data' ]
		}),


		listBackup: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'backup_list',
			expect: { files: [ ] }
		}),


		testReset: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'reset_test',
			expect: { supported: false }
		}),

		startReset: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'reset_start'
		}),


		performReboot: _luci2.rpc.declare({
			object: 'luci2.system',
			method: 'reboot'
		})
	};

	this.opkg = {
		updateLists: _luci2.rpc.declare({
			object: 'luci2.opkg',
			method: 'update',
			expect: { '': { } }
		}),

		_allPackages: _luci2.rpc.declare({
			object: 'luci2.opkg',
			method: 'list',
			params: [ 'offset', 'limit', 'pattern' ],
			expect: { '': { } }
		}),

		_installedPackages: _luci2.rpc.declare({
			object: 'luci2.opkg',
			method: 'list_installed',
			params: [ 'offset', 'limit', 'pattern' ],
			expect: { '': { } }
		}),

		_findPackages: _luci2.rpc.declare({
			object: 'luci2.opkg',
			method: 'find',
			params: [ 'offset', 'limit', 'pattern' ],
			expect: { '': { } }
		}),

		_fetchPackages: function(action, offset, limit, pattern)
		{
			var packages = [ ];

			return action(offset, limit, pattern).then(function(list) {
				if (!list.total || !list.packages)
					return { length: 0, total: 0 };

				packages.push.apply(packages, list.packages);
				packages.total = list.total;

				if (limit <= 0)
					limit = list.total;

				if (packages.length >= limit)
					return packages;

				_luci2.rpc.batch();

				for (var i = offset + packages.length; i < limit; i += 100)
					action(i, (Math.min(i + 100, limit) % 100) || 100, pattern);

				return _luci2.rpc.flush();
			}).then(function(lists) {
				for (var i = 0; i < lists.length; i++)
				{
					if (!lists[i].total || !lists[i].packages)
						continue;

					packages.push.apply(packages, lists[i].packages);
					packages.total = lists[i].total;
				}

				return packages;
			});
		},

		listPackages: function(offset, limit, pattern)
		{
			return _luci2.opkg._fetchPackages(_luci2.opkg._allPackages, offset, limit, pattern);
		},

		installedPackages: function(offset, limit, pattern)
		{
			return _luci2.opkg._fetchPackages(_luci2.opkg._installedPackages, offset, limit, pattern);
		},

		findPackages: function(offset, limit, pattern)
		{
			return _luci2.opkg._fetchPackages(_luci2.opkg._findPackages, offset, limit, pattern);
		},

		installPackage: _luci2.rpc.declare({
			object: 'luci2.opkg',
			method: 'install',
			params: [ 'package' ],
			expect: { '': { } }
		}),

		removePackage: _luci2.rpc.declare({
			object: 'luci2.opkg',
			method: 'remove',
			params: [ 'package' ],
			expect: { '': { } }
		}),

		getConfig: _luci2.rpc.declare({
			object: 'luci2.opkg',
			method: 'config_get',
			expect: { config: '' }
		}),

		setConfig: _luci2.rpc.declare({
			object: 'luci2.opkg',
			method: 'config_set',
			params: [ 'data' ]
		})
	};

	this.session = {

		login: _luci2.rpc.declare({
			object: 'session',
			method: 'login',
			params: [ 'username', 'password' ],
			expect: { '': { } }
		}),

		access: _luci2.rpc.declare({
			object: 'session',
			method: 'access',
			params: [ 'scope', 'object', 'function' ],
			expect: { access: false }
		}),

		isAlive: function()
		{
			return _luci2.session.access('ubus', 'session', 'access');
		},

		startHeartbeat: function()
		{
			this._hearbeatInterval = window.setInterval(function() {
				_luci2.session.isAlive().then(function(alive) {
					if (!alive)
					{
						_luci2.session.stopHeartbeat();
						_luci2.ui.login(true);
					}

				});
			}, _luci2.globals.timeout * 2);
		},

		stopHeartbeat: function()
		{
			if (typeof(this._hearbeatInterval) != 'undefined')
			{
				window.clearInterval(this._hearbeatInterval);
				delete this._hearbeatInterval;
			}
		}
	};

	this.ui = {

		saveScrollTop: function()
		{
			this._scroll_top = $(document).scrollTop();
		},

		restoreScrollTop: function()
		{
			if (typeof(this._scroll_top) == 'undefined')
				return;

			$(document).scrollTop(this._scroll_top);

			delete this._scroll_top;
		},

		loading: function(enable)
		{
			var win = $(window);
			var body = $('body');

			var state = _luci2.ui._loading || (_luci2.ui._loading = {
				modal: $('<div />')
					.addClass('modal fade')
					.append($('<div />')
						.addClass('modal-dialog')
						.append($('<div />')
							.addClass('modal-content luci2-modal-loader')
							.append($('<div />')
								.addClass('modal-body')
								.text(_luci2.tr('Loading data…')))))
					.appendTo(body)
					.modal({
						backdrop: 'static',
						keyboard: false
					})
			});

			state.modal.modal(enable ? 'show' : 'hide');
		},

		dialog: function(title, content, options)
		{
			var win = $(window);
			var body = $('body');

			var state = _luci2.ui._dialog || (_luci2.ui._dialog = {
				dialog: $('<div />')
					.addClass('modal fade')
					.append($('<div />')
						.addClass('modal-dialog')
						.append($('<div />')
							.addClass('modal-content')
							.append($('<div />')
								.addClass('modal-header')
								.append('<h4 />')
									.addClass('modal-title'))
							.append($('<div />')
								.addClass('modal-body'))
							.append($('<div />')
								.addClass('modal-footer')
								.append(_luci2.ui.button(_luci2.tr('Close'), 'primary')
									.click(function() {
										$(this).parents('div.modal').modal('hide');
									})))))
					.appendTo(body)
			});

			if (typeof(options) != 'object')
				options = { };

			if (title === false)
			{
				state.dialog.modal('hide');

				return;
			}

			var cnt = state.dialog.children().children().children('div.modal-body');
			var ftr = state.dialog.children().children().children('div.modal-footer');

			ftr.empty();

			if (options.style == 'confirm')
			{
				ftr.append(_luci2.ui.button(_luci2.tr('Ok'), 'primary')
					.click(options.confirm || function() { _luci2.ui.dialog(false) }));

				ftr.append(_luci2.ui.button(_luci2.tr('Cancel'), 'default')
					.click(options.cancel || function() { _luci2.ui.dialog(false) }));
			}
			else if (options.style == 'close')
			{
				ftr.append(_luci2.ui.button(_luci2.tr('Close'), 'primary')
					.click(options.close || function() { _luci2.ui.dialog(false) }));
			}
			else if (options.style == 'wait')
			{
				ftr.append(_luci2.ui.button(_luci2.tr('Close'), 'primary')
					.attr('disabled', true));
			}

			state.dialog.find('h4:first').text(title);
			state.dialog.modal('show');

			cnt.empty().append(content);
		},

		upload: function(title, content, options)
		{
			var state = _luci2.ui._upload || (_luci2.ui._upload = {
				form: $('<form />')
					.attr('method', 'post')
					.attr('action', '/cgi-bin/luci-upload')
					.attr('enctype', 'multipart/form-data')
					.attr('target', 'cbi-fileupload-frame')
					.append($('<p />'))
					.append($('<input />')
						.attr('type', 'hidden')
						.attr('name', 'sessionid'))
					.append($('<input />')
						.attr('type', 'hidden')
						.attr('name', 'filename'))
					.append($('<input />')
						.attr('type', 'file')
						.attr('name', 'filedata')
						.addClass('cbi-input-file'))
					.append($('<div />')
						.css('width', '100%')
						.addClass('progress progress-striped active')
						.append($('<div />')
							.addClass('progress-bar')
							.css('width', '100%')))
					.append($('<iframe />')
						.addClass('pull-right')
						.attr('name', 'cbi-fileupload-frame')
						.css('width', '1px')
						.css('height', '1px')
						.css('visibility', 'hidden')),

				finish_cb: function(ev) {
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
					else if (typeof(state.success_cb) == 'function')
					{
						state.success_cb(json);
					}
				},

				confirm_cb: function() {
					var f = state.form.find('.cbi-input-file');
					var b = state.form.find('.progress');
					var p = state.form.find('p');

					if (!f.val())
						return;

					state.form.find('iframe').on('load', state.finish_cb);
					state.form.submit();

					f.hide();
					b.show();
					p.text(_luci2.tr('File upload in progress …'));

					state.form.parent().parent().find('button').prop('disabled', true);
				}
			});

			state.form.find('.progress').hide();
			state.form.find('.cbi-input-file').val('').show();
			state.form.find('p').text(content || _luci2.tr('Select the file to upload and press "%s" to proceed.').format(_luci2.tr('Ok')));

			state.form.find('[name=sessionid]').val(_luci2.globals.sid);
			state.form.find('[name=filename]').val(options.filename);

			state.success_cb = options.success;

			_luci2.ui.dialog(title || _luci2.tr('File upload'), state.form, {
				style: 'confirm',
				confirm: state.confirm_cb
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
					_luci2.session.isAlive().then(function(access) {
						if (access)
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
			var state = _luci2.ui._login || (_luci2.ui._login = {
				form: $('<form />')
					.attr('target', '')
					.attr('method', 'post')
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
								.addClass('form-control')
								.keypress(function(ev) {
									if (ev.which == 10 || ev.which == 13)
										state.confirm_cb();
								}))))
					.append($('<p />')
						.append($('<label />')
							.text(_luci2.tr('Password'))
							.append($('<br />'))
							.append($('<input />')
								.attr('type', 'password')
								.attr('name', 'password')
								.addClass('form-control')
								.keypress(function(ev) {
									if (ev.which == 10 || ev.which == 13)
										state.confirm_cb();
								}))))
					.append($('<p />')
						.text(_luci2.tr('Enter your username and password above, then click "%s" to proceed.').format(_luci2.tr('Ok')))),

				response_cb: function(response) {
					if (!response.ubus_rpc_session)
					{
						_luci2.ui.login(true);
					}
					else
					{
						_luci2.globals.sid = response.ubus_rpc_session;
						_luci2.setHash('id', _luci2.globals.sid);
						_luci2.session.startHeartbeat();
						_luci2.ui.dialog(false);
						state.deferred.resolve();
					}
				},

				confirm_cb: function() {
					var u = state.form.find('[name=username]').val();
					var p = state.form.find('[name=password]').val();

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

					_luci2.globals.sid = '00000000000000000000000000000000';
					_luci2.session.login(u, p).then(state.response_cb);
				}
			});

			if (!state.deferred || state.deferred.state() != 'pending')
				state.deferred = $.Deferred();

			/* try to find sid from hash */
			var sid = _luci2.getHash('id');
			if (sid && sid.match(/^[a-f0-9]{32}$/))
			{
				_luci2.globals.sid = sid;
				_luci2.session.isAlive().then(function(access) {
					if (access)
					{
						_luci2.session.startHeartbeat();
						state.deferred.resolve();
					}
					else
					{
						_luci2.setHash('id', undefined);
						_luci2.ui.login();
					}
				});

				return state.deferred;
			}

			if (invalid)
				state.form.find('.alert-message').show();
			else
				state.form.find('.alert-message').hide();

			_luci2.ui.dialog(_luci2.tr('Authorization Required'), state.form, {
				style: 'confirm',
				confirm: state.confirm_cb
			});

			state.form.find('[name=password]').focus();

			return state.deferred;
		},

		cryptPassword: _luci2.rpc.declare({
			object: 'luci2.ui',
			method: 'crypt',
			params: [ 'data' ],
			expect: { crypt: '' }
		}),


		_acl_merge_scope: function(acl_scope, scope)
		{
			if ($.isArray(scope))
			{
				for (var i = 0; i < scope.length; i++)
					acl_scope[scope[i]] = true;
			}
			else if ($.isPlainObject(scope))
			{
				for (var object_name in scope)
				{
					if (!$.isArray(scope[object_name]))
						continue;

					var acl_object = acl_scope[object_name] || (acl_scope[object_name] = { });

					for (var i = 0; i < scope[object_name].length; i++)
						acl_object[scope[object_name][i]] = true;
				}
			}
		},

		_acl_merge_permission: function(acl_perm, perm)
		{
			if ($.isPlainObject(perm))
			{
				for (var scope_name in perm)
				{
					var acl_scope = acl_perm[scope_name] || (acl_perm[scope_name] = { });
					this._acl_merge_scope(acl_scope, perm[scope_name]);
				}
			}
		},

		_acl_merge_group: function(acl_group, group)
		{
			if ($.isPlainObject(group))
			{
				if (!acl_group.description)
					acl_group.description = group.description;

				if (group.read)
				{
					var acl_perm = acl_group.read || (acl_group.read = { });
					this._acl_merge_permission(acl_perm, group.read);
				}

				if (group.write)
				{
					var acl_perm = acl_group.write || (acl_group.write = { });
					this._acl_merge_permission(acl_perm, group.write);
				}
			}
		},

		_acl_merge_tree: function(acl_tree, tree)
		{
			if ($.isPlainObject(tree))
			{
				for (var group_name in tree)
				{
					var acl_group = acl_tree[group_name] || (acl_tree[group_name] = { });
					this._acl_merge_group(acl_group, tree[group_name]);
				}
			}
		},

		listAvailableACLs: _luci2.rpc.declare({
			object: 'luci2.ui',
			method: 'acls',
			expect: { acls: [ ] },
			filter: function(trees) {
				var acl_tree = { };
				for (var i = 0; i < trees.length; i++)
					_luci2.ui._acl_merge_tree(acl_tree, trees[i]);
				return acl_tree;
			}
		}),

		renderMainMenu: _luci2.rpc.declare({
			object: 'luci2.ui',
			method: 'menu',
			expect: { menu: { } },
			filter: function(entries) {
				_luci2.globals.mainMenu = new _luci2.ui.menu();
				_luci2.globals.mainMenu.entries(entries);

				$('#mainmenu')
					.empty()
					.append(_luci2.globals.mainMenu.render(0, 1));
			}
		}),

		renderViewMenu: function()
		{
			$('#viewmenu')
				.empty()
				.append(_luci2.globals.mainMenu.render(2, 900));
		},

		renderView: function()
		{
			var node = arguments[0];
			var name = node.view.split(/\//).join('.');
			var args = [ ];

			for (var i = 1; i < arguments.length; i++)
				args.push(arguments[i]);

			if (_luci2.globals.currentView)
				_luci2.globals.currentView.finish();

			_luci2.ui.renderViewMenu();

			if (!_luci2._views)
				_luci2._views = { };

			_luci2.setHash('view', node.view);

			if (_luci2._views[name] instanceof _luci2.ui.view)
			{
				_luci2.globals.currentView = _luci2._views[name];
				return _luci2._views[name].render.apply(_luci2._views[name], args);
			}

			var url = _luci2.globals.resource + '/view/' + name + '.js';

			return $.ajax(url, {
				method: 'GET',
				cache: true,
				dataType: 'text'
			}).then(function(data) {
				try {
					var viewConstructorSource = (
						'(function(L, $) { ' +
							'return %s' +
						'})(_luci2, $);\n\n' +
						'//@ sourceURL=%s'
					).format(data, url);

					var viewConstructor = eval(viewConstructorSource);

					_luci2._views[name] = new viewConstructor({
						name: name,
						acls: node.write || { }
					});

					_luci2.globals.currentView = _luci2._views[name];
					return _luci2._views[name].render.apply(_luci2._views[name], args);
				}
				catch(e) {
					alert('Unable to instantiate view "%s": %s'.format(url, e));
				};

				return $.Deferred().resolve();
			});
		},

		updateHostname: function()
		{
			return _luci2.system.getBoardInfo().then(function(info) {
				if (info.hostname)
					$('#hostname').text(info.hostname);
			});
		},

		updateChanges: function()
		{
			return _luci2.uci.changes().then(function(changes) {
				var n = 0;
				var html = '';

				for (var config in changes)
				{
					var log = [ ];

					for (var i = 0; i < changes[config].length; i++)
					{
						var c = changes[config][i];

						switch (c[0])
						{
						case 'order':
							break;

						case 'remove':
							if (c.length < 3)
								log.push('uci delete %s.<del>%s</del>'.format(config, c[1]));
							else
								log.push('uci delete %s.%s.<del>%s</del>'.format(config, c[1], c[2]));
							break;

						case 'rename':
							if (c.length < 4)
								log.push('uci rename %s.<ins>%s=<strong>%s</strong></ins>'.format(config, c[1], c[2], c[3]));
							else
								log.push('uci rename %s.%s.<ins>%s=<strong>%s</strong></ins>'.format(config, c[1], c[2], c[3], c[4]));
							break;

						case 'add':
							log.push('uci add %s <ins>%s</ins> (= <ins><strong>%s</strong></ins>)'.format(config, c[2], c[1]));
							break;

						case 'list-add':
							log.push('uci add_list %s.%s.<ins>%s=<strong>%s</strong></ins>'.format(config, c[1], c[2], c[3], c[4]));
							break;

						case 'list-del':
							log.push('uci del_list %s.%s.<del>%s=<strong>%s</strong></del>'.format(config, c[1], c[2], c[3], c[4]));
							break;

						case 'set':
							if (c.length < 4)
								log.push('uci set %s.<ins>%s=<strong>%s</strong></ins>'.format(config, c[1], c[2]));
							else
								log.push('uci set %s.%s.<ins>%s=<strong>%s</strong></ins>'.format(config, c[1], c[2], c[3], c[4]));
							break;
						}
					}

					html += '<code>/etc/config/%s</code><pre class="uci-changes">%s</pre>'.format(config, log.join('\n'));
					n += changes[config].length;
				}

				if (n > 0)
					$('#changes')
						.empty()
						.show()
						.append($('<a />')
							.attr('href', '#')
							.addClass('label')
							.addClass('notice')
							.text(_luci2.trcp('Pending configuration changes', '1 change', '%d changes', n).format(n))
							.click(function(ev) {
								_luci2.ui.dialog(_luci2.tr('Staged configuration changes'), html, { style: 'close' });
								ev.preventDefault();
							}));
				else
					$('#changes')
						.hide();
			});
		},

		init: function()
		{
			_luci2.ui.loading(true);

			$.when(
				_luci2.ui.updateHostname(),
				_luci2.ui.updateChanges(),
				_luci2.ui.renderMainMenu()
			).then(function() {
				_luci2.ui.renderView(_luci2.globals.defaultNode).then(function() {
					_luci2.ui.loading(false);
				})
			});
		},

		button: function(label, style, title)
		{
			style = style || 'default';

			return $('<button />')
				.attr('type', 'button')
				.attr('title', title ? title : '')
				.addClass('btn btn-' + style)
				.text(label);
		}
	};

	this.ui.AbstractWidget = Class.extend({
		i18n: function(text) {
			return text;
		},

		label: function() {
			var key = arguments[0];
			var args = [ ];

			for (var i = 1; i < arguments.length; i++)
				args.push(arguments[i]);

			switch (typeof(this.options[key]))
			{
			case 'undefined':
				return '';

			case 'function':
				return this.options[key].apply(this, args);

			default:
				return ''.format.apply('' + this.options[key], args);
			}
		},

		toString: function() {
			return $('<div />').append(this.render()).html();
		},

		insertInto: function(id) {
			return $(id).empty().append(this.render());
		},

		appendTo: function(id) {
			return $(id).append(this.render());
		}
	});

	this.ui.view = this.ui.AbstractWidget.extend({
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
				container.append($('<p />').append(this.description));

			var self = this;
			var args = [ ];

			for (var i = 0; i < arguments.length; i++)
				args.push(arguments[i]);

			return this._fetch_template().then(function() {
				return _luci2.deferrable(self.execute.apply(self, args));
			});
		},

		repeat: function(func, interval)
		{
			var self = this;

			if (!self._timeouts)
				self._timeouts = [ ];

			var index = self._timeouts.length;

			if (typeof(interval) != 'number')
				interval = 5000;

			var setTimer, runTimer;

			setTimer = function() {
				if (self._timeouts)
					self._timeouts[index] = window.setTimeout(runTimer, interval);
			};

			runTimer = function() {
				_luci2.deferrable(func.call(self)).then(setTimer, setTimer);
			};

			runTimer();
		},

		finish: function()
		{
			if ($.isArray(this._timeouts))
			{
				for (var i = 0; i < this._timeouts.length; i++)
					window.clearTimeout(this._timeouts[i]);

				delete this._timeouts;
			}
		}
	});

	this.ui.menu = this.ui.AbstractWidget.extend({
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
					for (var key in child)
						if (!node.hasOwnProperty(key) && child.hasOwnProperty(key))
							node[key] = child[key];

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
				list.addClass('nav').addClass('navbar-nav');
			else if (level == 1)
				list.addClass('dropdown-menu').addClass('navbar-inverse');

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
						.text(_luci2.tr(nodes[i].title)))
					.appendTo(list);

				if (nodes[i].childs && level < max)
				{
					item.addClass('dropdown');

					item.find('a')
						.addClass('dropdown-toggle')
						.attr('data-toggle', 'dropdown')
						.append('<b class="caret"></b>');

					item.append(this._render(nodes[i].childs, level + 1));
				}
				else
				{
					item.find('a').click(nodes[i], this._onclick);
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

	this.ui.table = this.ui.AbstractWidget.extend({
		init: function()
		{
			this._rows = [ ];
		},

		row: function(values)
		{
			if ($.isArray(values))
			{
				this._rows.push(values);
			}
			else if ($.isPlainObject(values))
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
				table.className = 'table table-condensed table-hover';

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

	this.ui.progress = this.ui.AbstractWidget.extend({
		render: function()
		{
			var vn = parseInt(this.options.value) || 0;
			var mn = parseInt(this.options.max) || 100;
			var pc = Math.floor((100 / mn) * vn);

			var text;

			if (typeof(this.options.format) == 'string')
				text = this.options.format.format(this.options.value, this.options.max, pc);
			else if (typeof(this.options.format) == 'function')
				text = this.options.format(pc);
			else
				text = '%.2f%%'.format(pc);

			return $('<div />')
				.addClass('progress')
				.append($('<div />')
					.addClass('progress-bar')
					.addClass('progress-bar-info')
					.css('width', pc + '%'))
				.append($('<small />')
					.text(text));
		}
	});

	this.ui.devicebadge = this.ui.AbstractWidget.extend({
		render: function()
		{
			var l2dev = this.options.l2_device || this.options.device;
			var l3dev = this.options.l3_device;
			var dev = l3dev || l2dev || '?';

			var span = document.createElement('span');
				span.className = 'badge';

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

				if (l3dev != l2dev)
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

			validation.i18n('Must be a valid IPv6 address');
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


	this.cbi.AbstractValue = this.ui.AbstractWidget.extend({
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

		render: function(sid, condensed)
		{
			var i = this.instance[sid] = { };

			i.top = $('<div />');

			if (!condensed)
			{
				i.top.addClass('form-group');

				if (typeof(this.options.caption) == 'string')
					$('<label />')
						.addClass('col-lg-2 control-label')
						.attr('for', this.id(sid))
						.text(this.options.caption)
						.appendTo(i.top);
			}

			i.error = $('<div />')
				.addClass('label label-danger');

			i.widget = $('<div />')

				.append(this.widget(sid))
				.append(i.error)
				.appendTo(i.top);

			if (!condensed)
			{
				i.widget.addClass('col-lg-5');

				$('<div />')
					.addClass('col-lg-5')
					.text((typeof(this.options.description) == 'string') ? this.options.description : '')
					.appendTo(i.top);
			}

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

		_ev_validate: function(ev)
		{
			var d = ev.data;
			var rv = true;
			var val = d.elem.val();
			var vstack = d.vstack;

			if (vstack && typeof(vstack[0]) == 'function')
			{
				delete validation.message;

				if ((val.length == 0 && !d.opt))
				{
					d.elem.parents('div.form-group, td').first().addClass('luci2-form-error');
					d.elem.parents('div.input-group, div.form-group, td').first().addClass('has-error');

					d.inst.error.text(_luci2.tr('Field must not be empty'));
					rv = false;
				}
				else if (val.length > 0 && !vstack[0].apply(val, vstack[1]))
				{
					d.elem.parents('div.form-group, td').first().addClass('luci2-form-error');
					d.elem.parents('div.input-group, div.form-group, td').first().addClass('has-error');

					d.inst.error.text(validation.message.format.apply(validation.message, vstack[1]));
					rv = false;
				}
				else
				{
					d.elem.parents('div.form-group, td').first().removeClass('luci2-form-error');
					d.elem.parents('div.input-group, div.form-group, td').first().removeClass('has-error');

					if (d.multi && d.inst.widget && d.inst.widget.find('input.error, select.error').length > 0)
						rv = false;
					else
						d.inst.error.text('');
				}
			}

			if (rv)
				for (var field in d.self.rdependency)
					d.self.rdependency[field].toggle(d.sid);

			return rv;
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
				self:   this,
				sid:    sid,
				elem:   elem,
				multi:  multi,
				vstack: vstack,
				inst:   this.instance[sid],
				opt:    this.options.optional
			};

			if (elem.prop('tagName') == 'SELECT')
			{
				elem.change(evdata, this._ev_validate);
			}
			else if (elem.prop('tagName') == 'INPUT' && elem.attr('type') == 'checkbox')
			{
				elem.click(evdata, this._ev_validate);
				elem.blur(evdata, this._ev_validate);
			}
			else
			{
				elem.keyup(evdata, this._ev_validate);
				elem.blur(evdata, this._ev_validate);
			}

			elem.attr('cbi-validate', true).on('validate', evdata, this._ev_validate);

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
					else if (d[i] instanceof _luci2.cbi.AbstractValue)
						dep[d[i].name] = true;
				}
			}
			else if (d instanceof _luci2.cbi.AbstractValue)
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

	this.cbi.CheckboxValue = this.cbi.AbstractValue.extend({
		widget: function(sid)
		{
			var o = this.options;

			if (typeof(o.enabled)  == 'undefined') o.enabled  = '1';
			if (typeof(o.disabled) == 'undefined') o.disabled = '0';

			var i = $('<input />')
				.addClass('form-control')
				.attr('id', this.id(sid))
				.attr('type', 'checkbox')
				.prop('checked', this.ucivalue(sid));

			return $('<div />')
				.addClass('checkbox')
				.append(this.validator(sid, i));
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
				if (this.options.optional && val == this.options.initial)
					this.map.set(uci.config, uci.section, uci.option, undefined);
				else
					this.map.set(uci.config, uci.section, uci.option, val ? this.options.enabled : this.options.disabled);
			}

			return chg;
		}
	});

	this.cbi.InputValue = this.cbi.AbstractValue.extend({
		widget: function(sid)
		{
			var i = $('<input />')
				.addClass('form-control')
				.attr('id', this.id(sid))
				.attr('type', 'text')
				.attr('placeholder', this.options.placeholder)
				.val(this.ucivalue(sid));

			return this.validator(sid, i);
		}
	});

	this.cbi.PasswordValue = this.cbi.AbstractValue.extend({
		widget: function(sid)
		{
			var i = $('<input />')
				.addClass('form-control')
				.attr('id', this.id(sid))
				.attr('type', 'password')
				.attr('placeholder', this.options.placeholder)
				.val(this.ucivalue(sid));

			var t = $('<span />')
				.addClass('input-group-btn')
				.append(_luci2.ui.button(_luci2.tr('Reveal'), 'default')
					.click(function(ev) {
						var b = $(this);
						var i = b.parent().prev();
						var t = i.attr('type');
						b.text(t == 'password' ? _luci2.tr('Hide') : _luci2.tr('Reveal'));
						i.attr('type', (t == 'password') ? 'text' : 'password');
						b = i = t = null;
					}));

			this.validator(sid, i);

			return $('<div />')
				.addClass('input-group')
				.append(i)
				.append(t);
		}
	});

	this.cbi.ListValue = this.cbi.AbstractValue.extend({
		widget: function(sid)
		{
			var s = $('<select />')
				.addClass('form-control');

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
						.addClass('checkbox')
						.append($('<input />')
							.attr('type', 'checkbox')
							.attr('value', this.choices[i][0])
							.prop('checked', s[this.choices[i][0]]))
						.append(this.choices[i][1])
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

	this.cbi.ComboBox = this.cbi.AbstractValue.extend({
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

			$(s.parent).children('div.input-group').children('input').each(function(i) {
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
					index: i,
					remove: ((i+1) < v.length)
				};

				var btn;
				if (evdata.remove)
					btn = _luci2.ui.button('–', 'danger').click(evdata, this._btnclick);
				else
					btn = _luci2.ui.button('+', 'success').click(evdata, this._btnclick);

				if (this.choices)
				{
					var txt = $('<input />')
						.addClass('form-control')
						.attr('type', 'text')
						.hide();

					var sel = $('<select />')
						.addClass('form-control');

					$('<div />')
						.addClass('input-group')
						.append(txt)
						.append(sel)
						.append($('<span />')
							.addClass('input-group-btn')
							.append(btn))
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
						.addClass('form-control')
						.keydown(evdata, this._keydown)
						.keypress(evdata, this._keypress)
						.val(v[i]);

					$('<div />')
						.addClass('input-group')
						.append(f)
						.append($('<span />')
							.addClass('input-group-btn')
							.append(btn))
						.appendTo(s.parent);

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
					var prev = input.parent().prevAll('div.input-group:first').children('input');
					if (prev.is(':visible'))
						prev.focus();
					else
						prev.next('select').focus();
					break;

				/* arrow down */
				case 40:
					var next = input.parent().nextAll('div.input-group:first').children('input');
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
				if (ev.data.remove)
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

	this.cbi.DummyValue = this.cbi.AbstractValue.extend({
		widget: function(sid)
		{
			return $('<div />')
				.addClass('form-control-static')
				.attr('id', this.id(sid))
				.html(this.ucivalue(sid));
		},

		formvalue: function(sid)
		{
			return this.ucivalue(sid);
		}
	});

	this.cbi.NetworkList = this.cbi.AbstractValue.extend({
		load: function(sid)
		{
			var self = this;

			if (!self.interfaces)
			{
				self.interfaces = [ ];
				return _luci2.network.getNetworkStatus().then(function(ifaces) {
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
			else if (dev.device.indexOf('.') > 0)
			{
				type = 'vlan';
				desc = _luci2.tr('VLAN interface');
			}

			return $('<img />')
				.attr('src', _luci2.globals.resource + '/icons/' + type + (dev.up ? '' : '_disabled') + '.png')
				.attr('title', '%s (%s)'.format(desc, dev.device));
		},

		widget: function(sid)
		{
			var id = this.id(sid);
			var ul = $('<ul />')
				.attr('id', id)
				.addClass('list-unstyled');

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
						.addClass('badge')
						.text('%s: '.format(iface['interface']));

					if (iface.device && iface.device.subdevices)
						for (var j = 0; j < iface.device.subdevices.length; j++)
							badge.append(this._device_icon(iface.device.subdevices[j]));
					else if (iface.device)
						badge.append(this._device_icon(iface.device));
					else
						badge.append($('<em />').text(_luci2.tr('(No devices attached)')));

					$('<li />')
						.append($('<label />')
							.addClass('radio inline')
							.append($('<input />')
								.attr('name', itype + id)
								.attr('type', itype)
								.attr('value', iface['interface'])
								.prop('checked', !!check[iface['interface']])
								.addClass('form-control'))
							.append(badge))
						.appendTo(ul);
				}
			}

			if (!this.options.multiple)
			{
				$('<li />')
					.append($('<label />')
						.addClass('radio inline text-muted')
						.append($('<input />')
							.attr('name', itype + id)
							.attr('type', itype)
							.attr('value', '')
							.prop('checked', !value)
							.addClass('form-control'))
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


	this.cbi.AbstractSection = this.ui.AbstractWidget.extend({
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

			if (!(w instanceof _luci2.cbi.AbstractValue))
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

		validate_section: function(sid)
		{
			var inst = this.instance[sid];

			var invals = 0;
			var badge = $('#' + this.id('teaser', sid)).children('span:first');

			for (var i = 0; i < this.tabs.length; i++)
			{
				var inval = 0;
				var stbadge = $('#' + this.id('nodetab', sid, this.tabs[i].id)).children('span:first');

				for (var j = 0; j < this.tabs[i].fields.length; j++)
					if (!this.tabs[i].fields[j].validate(sid))
						inval++;

				if (inval > 0)
					stbadge.text(inval)
						.attr('title', _luci2.trp('1 Error', '%d Errors', inval).format(inval));
				else
					stbadge.text('');

				invals += inval;
			}

			if (invals > 0)
				badge.text(invals)
					.attr('title', _luci2.trp('1 Error', '%d Errors', invals).format(invals));
			else
				badge.text('');

			return invals;
		},

		validate: function()
		{
			this.error_count = 0;

			var as = this.sections();

			for (var i = 0; i < as.length; i++)
			{
				var invals = this.validate_section(as[i]['.name']);

				if (invals > 0)
					this.error_count += invals;
			}

			var badge = $('#' + this.id('sectiontab')).children('span:first');

			if (this.error_count > 0)
				badge.text(this.error_count)
					.attr('title', _luci2.trp('1 Error', '%d Errors', this.error_count).format(this.error_count));
			else
				badge.text('');

			return (this.error_count == 0);
		}
	});

	this.cbi.TypedSection = this.cbi.AbstractSection.extend({
		init: function(uci_type, options)
		{
			this.uci_type = uci_type;
			this.options  = options;
			this.tabs     = [ ];
			this.fields   = { };
			this.error_count  = 0;
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

		_ev_add: function(ev)
		{
			var addb = $(this);
			var name = undefined;
			var self = ev.data.self;

			if (addb.prev().prop('nodeName') == 'INPUT')
				name = addb.prev().val();

			if (addb.prop('disabled') || name === '')
				return;

			_luci2.ui.saveScrollTop();

			self.active_panel = -1;
			self.map.save();
			self.add(name);
			self.map.redraw();

			_luci2.ui.restoreScrollTop();
		},

		_ev_remove: function(ev)
		{
			var self = ev.data.self;
			var sid  = ev.data.sid;

			_luci2.ui.saveScrollTop();

			self.map.save();
			self.remove(sid);
			self.map.redraw();

			_luci2.ui.restoreScrollTop();

			ev.stopPropagation();
		},

		_ev_sid: function(ev)
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

		_ev_tab: function(ev)
		{
			var self = ev.data.self;
			var sid  = ev.data.sid;

			self.validate();
			self.active_tab[sid] = parseInt(ev.target.getAttribute('data-luci2-tab-index'));
		},

		_ev_panel_collapse: function(ev)
		{
			var self = ev.data.self;

			var this_panel = $(ev.target);
			var this_toggle = this_panel.prevAll('[data-toggle="collapse"]:first');

			var prev_toggle = $($(ev.delegateTarget).find('[data-toggle="collapse"]:eq(%d)'.format(self.active_panel)));
			var prev_panel = $(prev_toggle.attr('data-target'));

			prev_panel
				.removeClass('in')
				.addClass('collapse');

			prev_toggle.find('.luci2-section-teaser')
				.show()
				.children('span:last')
				.empty()
				.append(self.teaser(prev_panel.attr('data-luci2-sid')));

			this_toggle.find('.luci2-section-teaser')
				.hide();

			self.active_panel = parseInt(this_panel.attr('data-luci2-panel-index'));
			self.validate();
		},

		_ev_panel_open: function(ev)
		{
			var self  = ev.data.self;
			var panel = $($(this).attr('data-target'));
			var index = parseInt(panel.attr('data-luci2-panel-index'));

			if (index == self.active_panel)
				ev.stopPropagation();
		},

		_ev_sort: function(ev)
		{
			var self    = ev.data.self;
			var cur_idx = ev.data.index;
			var new_idx = cur_idx + (ev.data.up ? -1 : 1);
			var s       = self.sections();

			if (new_idx >= 0 && new_idx < s.length)
			{
				var tmp = s[cur_idx]['.index'];

				s[cur_idx]['.index'] = s[new_idx]['.index'];
				s[new_idx]['.index'] = tmp;

				if (self.active_panel == cur_idx)
					self.active_panel = new_idx;
				else if (self.active_panel == new_idx)
					self.active_panel = cur_idx;

				self.map.uci.reorder = true;

				self.map.save();
				self.map.redraw();
			}

			ev.stopPropagation();
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
						if (f instanceof _luci2.cbi.AbstractValue)
							tf.push(f);
						else if (typeof(f) == 'string' && this.fields[f] instanceof _luci2.cbi.AbstractValue)
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
			if (!this.options.addremove)
				return null;

			var text = _luci2.tr('Add section');
			var ttip = _luci2.tr('Create new section...');

			if ($.isArray(this.options.add_caption))
				text = this.options.add_caption[0], ttip = this.options.add_caption[1];
			else if (typeof(this.options.add_caption) == 'string')
				text = this.options.add_caption, ttip = '';

			var add = $('<div />');

			if (this.options.anonymous === false)
			{
				$('<input />')
					.addClass('cbi-input-text')
					.attr('type', 'text')
					.attr('placeholder', ttip)
					.blur({ self: this }, this._ev_sid)
					.keyup({ self: this }, this._ev_sid)
					.appendTo(add);

				$('<img />')
					.attr('src', _luci2.globals.resource + '/icons/cbi/add.gif')
					.attr('title', text)
					.addClass('cbi-button')
					.click({ self: this }, this._ev_add)
					.appendTo(add);

				$('<div />')
					.addClass('cbi-value-error')
					.hide()
					.appendTo(add);
			}
			else
			{
				_luci2.ui.button(text, 'success', ttip)
					.click({ self: this }, this._ev_add)
					.appendTo(add);
			}

			return add;
		},

		_render_remove: function(sid, index)
		{
			if (!this.options.addremove)
				return null;

			var text = _luci2.tr('Remove');
			var ttip = _luci2.tr('Remove this section');

			if ($.isArray(this.options.remove_caption))
				text = this.options.remove_caption[0], ttip = this.options.remove_caption[1];
			else if (typeof(this.options.remove_caption) == 'string')
				text = this.options.remove_caption, ttip = '';

			return _luci2.ui.button(text, 'danger', ttip)
				.click({ self: this, sid: sid, index: index }, this._ev_remove);
		},

		_render_sort: function(sid, index)
		{
			if (!this.options.sortable)
				return null;

			var b1 = _luci2.ui.button('↑', 'info', _luci2.tr('Move up'))
				.click({ self: this, index: index, up: true }, this._ev_sort);

			var b2 = _luci2.ui.button('↓', 'info', _luci2.tr('Move down'))
				.click({ self: this, index: index, up: false }, this._ev_sort);

			return b1.add(b2);
		},

		_render_caption: function()
		{
			return $('<h3 />')
				.addClass('panel-title')
				.append(this.label('caption') || this.uci_type);
		},

		_render_description: function()
		{
			var text = this.label('description');

			if (text)
				return $('<div />')
					.addClass('luci2-section-description')
					.text(text);

			return null;
		},

		_render_teaser: function(sid, index)
		{
			if (this.options.collabsible || this.map.options.collabsible)
			{
				return $('<div />')
					.attr('id', this.id('teaser', sid))
					.addClass('luci2-section-teaser well well-sm')
					.append($('<span />')
						.addClass('badge'))
					.append($('<span />'));
			}

			return null;
		},

		_render_head: function(condensed)
		{
			if (condensed)
				return null;

			return $('<div />')
				.addClass('panel-heading')
				.append(this._render_caption())
				.append(this._render_description());
		},

		_render_tab_description: function(sid, index, tab_index)
		{
			var tab = this.tabs[tab_index];

			if (typeof(tab.description) == 'string')
			{
				return $('<div />')
					.addClass('cbi-tab-descr')
					.text(tab.description);
			}

			return null;
		},

		_render_tab_head: function(sid, index, tab_index)
		{
			var tab = this.tabs[tab_index];
			var cur = this.active_tab[sid] || 0;

			var tabh = $('<li />')
				.append($('<a />')
					.attr('id', this.id('nodetab', sid, tab.id))
					.attr('href', '#' + this.id('node', sid, tab.id))
					.attr('data-toggle', 'tab')
					.attr('data-luci2-tab-index', tab_index)
					.text((tab.caption ? tab.caption.format(tab.id) : tab.id) + ' ')
					.append($('<span />')
						.addClass('badge'))
					.on('shown.bs.tab', { self: this, sid: sid }, this._ev_tab));

			if (cur == tab_index)
				tabh.addClass('active');

			return tabh;
		},

		_render_tab_body: function(sid, index, tab_index)
		{
			var tab = this.tabs[tab_index];
			var cur = this.active_tab[sid] || 0;

			var tabb = $('<div />')
				.addClass('tab-pane')
				.attr('id', this.id('node', sid, tab.id))
				.attr('data-luci2-tab-index', tab_index)
				.append(this._render_tab_description(sid, index, tab_index));

			if (cur == tab_index)
				tabb.addClass('active');

			for (var i = 0; i < tab.fields.length; i++)
				tabb.append(tab.fields[i].render(sid));

			return tabb;
		},

		_render_section_head: function(sid, index)
		{
			var head = $('<div />')
				.addClass('luci2-section-header')
				.append(this._render_teaser(sid, index))
				.append($('<div />')
					.addClass('btn-group')
					.append(this._render_sort(sid, index))
					.append(this._render_remove(sid, index)));

			if (this.options.collabsible)
			{
				head.attr('data-toggle', 'collapse')
					.attr('data-parent', this.id('sectiongroup'))
					.attr('data-target', '#' + this.id('panel', sid))
					.on('click', { self: this }, this._ev_panel_open);
			}

			return head;
		},

		_render_section_body: function(sid, index)
		{
			var body = $('<div />')
				.attr('id', this.id('panel', sid))
				.attr('data-luci2-panel-index', index)
				.attr('data-luci2-sid', sid);

			if (this.options.collabsible || this.map.options.collabsible)
			{
				body.addClass('panel-collapse collapse');

				if (index == this.active_panel)
					body.addClass('in');
			}

			var tab_heads = $('<ul />')
				.addClass('nav nav-tabs');

			var tab_bodies = $('<div />')
				.addClass('form-horizontal tab-content')
				.append(tab_heads);

			for (var j = 0; j < this.tabs.length; j++)
			{
				tab_heads.append(this._render_tab_head(sid, index, j));
				tab_bodies.append(this._render_tab_body(sid, index, j));
			}

			body.append(tab_bodies);

			if (this.tabs.length <= 1)
				tab_heads.hide();

			return body;
		},

		_render_body: function(condensed)
		{
			var s = this.sections();

			if (this.active_panel < 0)
				this.active_panel += s.length;
			else if (this.active_panel >= s.length)
				this.active_panel = s.length - 1;

			var body = $('<ul />')
				.addClass('list-group');

			if (this.options.collabsible)
			{
				body.attr('id', this.id('sectiongroup'))
					.on('show.bs.collapse', { self: this }, this._ev_panel_collapse);
			}

			if (s.length == 0)
			{
				body.append($('<li />')
					.addClass('list-group-item text-muted')
					.text(this.label('placeholder') || _luci2.tr('There are no entries defined yet.')))
			}

			for (var i = 0; i < s.length; i++)
			{
				var sid = s[i]['.name'];
				var inst = this.instance[sid] = { tabs: [ ] };

				body.append($('<li />')
					.addClass('list-group-item')
					.append(this._render_section_head(sid, i))
					.append(this._render_section_body(sid, i)));
			}

			return body;
		},

		render: function(condensed)
		{
			this.instance = { };

			var panel = $('<div />')
				.addClass('panel panel-default')
				.append(this._render_head(condensed))
				.append(this._render_body(condensed));

			if (this.options.addremove)
				panel.append($('<div />')
					.addClass('panel-footer')
					.append(this._render_add()));

			return panel;
		},

		finish: function()
		{
			var s = this.sections();

			for (var i = 0; i < s.length; i++)
			{
				var sid = s[i]['.name'];

				this.validate_section(sid);

				if (i != this.active_panel)
					$('#' + this.id('teaser', sid)).children('span:last')
						.append(this.teaser(sid));
				else
					$('#' + this.id('teaser', sid))
						.hide();
			}
		}
	});

	this.cbi.TableSection = this.cbi.TypedSection.extend({
		_render_table_head: function()
		{
			var thead = $('<thead />')
				.append($('<tr />')
					.addClass('cbi-section-table-titles'));

			for (var j = 0; j < this.tabs[0].fields.length; j++)
				thead.children().append($('<th />')
					.addClass('cbi-section-table-cell')
					.css('width', this.tabs[0].fields[j].options.width || '')
					.append(this.tabs[0].fields[j].label('caption')));

			if (this.options.addremove !== false || this.options.sortable)
				thead.children().append($('<th />')
					.addClass('cbi-section-table-cell')
					.text(' '));

			return thead;
		},

		_render_table_row: function(sid, index)
		{
			var row = $('<tr />')
				.attr('data-luci2-sid', sid);

			for (var j = 0; j < this.tabs[0].fields.length; j++)
			{
				row.append($('<td />')
					.css('width', this.tabs[0].fields[j].options.width || '')
					.append(this.tabs[0].fields[j].render(sid, true)));
			}

			if (this.options.addremove !== false || this.options.sortable)
			{
				row.append($('<td />')
					.addClass('text-right')
					.append($('<div />')
						.addClass('btn-group')
						.append(this._render_sort(sid, index))
						.append(this._render_remove(sid, index))));
			}

			return row;
		},

		_render_table_body: function()
		{
			var s = this.sections();

			var tbody = $('<tbody />');

			if (s.length == 0)
			{
				var cols = this.tabs[0].fields.length;

				if (this.options.addremove !== false || this.options.sortable)
					cols++;

				tbody.append($('<tr />')
					.append($('<td />')
						.addClass('text-muted')
						.attr('colspan', cols)
						.text(this.label('placeholder') || _luci2.tr('There are no entries defined yet.'))));
			}

			for (var i = 0; i < s.length; i++)
			{
				var sid = s[i]['.name'];
				var inst = this.instance[sid] = { tabs: [ ] };

				tbody.append(this._render_table_row(sid, i));
			}

			return tbody;
		},

		_render_body: function(condensed)
		{
			return $('<table />')
				.addClass('table table-condensed table-hover')
				.append(this._render_table_head())
				.append(this._render_table_body());
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

	this.cbi.Map = this.ui.AbstractWidget.extend({
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

		_load_cb: function(packages)
		{
			for (var i = 0; i < packages.length; i++)
			{
				this.uci.values[packages[i]['.package']] = packages[i];
				delete packages[i]['.package'];
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
						if (_luci2.isDeferred(rv))
							deferreds.push(rv);
					}
				}
			}

			return $.when.apply($, deferreds);
		},

		load: function()
		{
			var self = this;

			this.uci = {
				newid:   0,
				values:  { },
				creates: { },
				changes: { },
				deletes: { },
				reorder: false
			};

			var packages = { };

			for (var i = 0; i < this.sections.length; i++)
				this.sections[i].ucipackages(packages);

			packages[this.uci_package] = true;

			_luci2.rpc.batch();

			for (var pkg in packages)
				_luci2.uci.get_all(pkg);

			return _luci2.rpc.flush().then(function(packages) {
				return self._load_cb(packages);
			});
		},

		_ev_tab: function(ev)
		{
			var self = ev.data.self;

			self.validate();
			self.active_tab = parseInt(ev.target.getAttribute('data-luci2-tab-index'));
		},

		_render_tab_head: function(tab_index)
		{
			var section = this.sections[tab_index];
			var cur = this.active_tab || 0;

			var tabh = $('<li />')
				.append($('<a />')
					.attr('id', section.id('sectiontab'))
					.attr('href', '#' + section.id('section'))
					.attr('data-toggle', 'tab')
					.attr('data-luci2-tab-index', tab_index)
					.text(section.label('caption') + ' ')
					.append($('<span />')
						.addClass('badge'))
					.on('shown.bs.tab', { self: this }, this._ev_tab));

			if (cur == tab_index)
				tabh.addClass('active');

			return tabh;
		},

		_render_tab_body: function(tab_index)
		{
			var section = this.sections[tab_index];
			var desc = section.label('description');
			var cur = this.active_tab || 0;

			var tabb = $('<div />')
				.addClass('tab-pane')
				.attr('id', section.id('section'))
				.attr('data-luci2-tab-index', tab_index);

			if (cur == tab_index)
				tabb.addClass('active');

			if (desc)
				tabb.append($('<p />')
					.text(desc));

			var s = section.render(this.options.tabbed);

			if (this.options.readonly || section.options.readonly)
				s.find('input, select, button, img.cbi-button').attr('disabled', true);

			tabb.append(s);

			return tabb;
		},

		_render_body: function()
		{
			var tabs = $('<ul />')
				.addClass('nav nav-tabs');

			var body = $('<div />')
				.append(tabs);

			for (var i = 0; i < this.sections.length; i++)
			{
				tabs.append(this._render_tab_head(i));
				body.append(this._render_tab_body(i));
			}

			if (this.options.tabbed)
				body.addClass('tab-content');
			else
				tabs.hide();

			return body;
		},

		render: function()
		{
			var map = $('<form />');

			if (typeof(this.options.caption) == 'string')
				map.append($('<h2 />')
					.text(this.options.caption));

			if (typeof(this.options.description) == 'string')
				map.append($('<p />')
					.text(this.options.description));

			map.append(this._render_body());

			if (this.options.pageaction !== false)
			{
				map.append($('<div />')
					.addClass('panel panel-default panel-body text-right')
					.append($('<div />')
						.addClass('btn-group')
						.append(_luci2.ui.button(_luci2.tr('Save & Apply'), 'primary')
							.click({ self: this }, function(ev) {  }))
						.append(_luci2.ui.button(_luci2.tr('Save'), 'default')
							.click({ self: this }, function(ev) { ev.data.self.send(); }))
						.append(_luci2.ui.button(_luci2.tr('Reset'), 'default')
							.click({ self: this }, function(ev) { ev.data.self.insertInto(ev.data.self.target); }))));
			}

			return map;
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

			if (!(w instanceof _luci2.cbi.AbstractSection))
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
				'.anonymous': !name,
				'.index':     1000 + this.uci.newid
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

			if (crt)
				for (var s in crt)
					sa.push(crt[s]);

			sa.sort(function(a, b) {
				return a['.index'] - b['.index'];
			});

			for (var i = 0; i < sa.length; i++)
				sa[i]['.index'] = i;

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
			{
				if (!this.sections[i].validate())
					rv = false;
			}

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
						if (_luci2.isDeferred(rv))
							deferreds.push(rv);
					}
				}
			}

			return $.when.apply($, deferreds);
		},

		_send_uci_reorder: function()
		{
			if (!this.uci.reorder)
				return _luci2.deferrable();

			_luci2.rpc.batch();

			/*
			 gather all created and existing sections, sort them according
			 to their index value and issue an uci order call
			*/
			for (var c in this.uci.values)
			{
				var o = [ ];

				if (this.uci.creates && this.uci.creates[c])
					for (var s in this.uci.creates[c])
						o.push(this.uci.creates[c][s]);

				for (var s in this.uci.values[c])
					o.push(this.uci.values[c][s]);

				if (o.length > 0)
				{
					o.sort(function(a, b) {
						return (a['.index'] - b['.index']);
					});

					var sids = [ ];

					for (var i = 0; i < o.length; i++)
						sids.push(o[i]['.name']);

					_luci2.uci.order(c, sids);
				}
			}

			return _luci2.rpc.flush();
		},

		_send_uci: function()
		{
			_luci2.rpc.batch();

			var self = this;
			var snew = [ ];

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
								r.type = this.uci.creates[c][s][k];
							else if (k == '.create')
								r.name = this.uci.creates[c][s][k];
							else if (k.charAt(0) != '.')
								r.values[k] = this.uci.creates[c][s][k];
						}

						snew.push(this.uci.creates[c][s]);

						_luci2.uci.add(r.config, r.type, r.name, r.values);
					}

			if (this.uci.changes)
				for (var c in this.uci.changes)
					for (var s in this.uci.changes[c])
						_luci2.uci.set(c, s, this.uci.changes[c][s]);

			if (this.uci.deletes)
				for (var c in this.uci.deletes)
					for (var s in this.uci.deletes[c])
					{
						var o = this.uci.deletes[c][s];
						_luci2.uci['delete'](c, s, (o === true) ? undefined : o);
					}

			return _luci2.rpc.flush().then(function(responses) {
				/*
				 array "snew" holds references to the created uci sections,
				 use it to assign the returned names of the new sections
				*/
				for (var i = 0; i < snew.length; i++)
					snew[i]['.name'] = responses[i];

				return self._send_uci_reorder();
			});
		},

		send: function()
		{
			if (!this.validate())
				return _luci2.deferrable();

			var self = this;

			_luci2.ui.saveScrollTop();
			_luci2.ui.loading(true);

			return this.save().then(function() {
				return self._send_uci();
			}).then(function() {
				return _luci2.ui.updateChanges();
			}).then(function() {
				return self.load();
			}).then(function() {
				self.redraw();
				self = null;

				_luci2.ui.loading(false);
				_luci2.ui.restoreScrollTop();
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
