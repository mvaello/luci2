L.ui.view.extend({
    execute: function() {
        var m = new L.cbi.Map('dropbear', {
            caption:     L.tr('SSH Access'),
            description: L.tr('Dropbear offers SSH network shell access and an integrated SCP server'),
            collabsible: true
        });

        var s1 = m.section(L.cbi.DummySection, '__password', {
            caption:     L.tr('Router Password'),
            description: L.tr('Changes the administrator password for accessing the device'),
            readonly:    !this.options.acls.admin
        });

        var p1 = s1.option(L.cbi.PasswordValue, 'pass1', {
            caption:     L.tr('Password'),
            optional:    true
        });

        var p2 = s1.option(L.cbi.PasswordValue, 'pass2', {
            caption:     L.tr('Confirmation'),
            optional:    true,
            datatype:    function(v) {
                var v1 = p1.formvalue('__password');
                if (v1 && v1.length && v != v1)
                    return L.tr('Passwords must match!');
                return true;
            }
        });

        p1.save = function(sid) { };
        p2.save = function(sid) {
            var v1 = p1.formvalue(sid);
            var v2 = p2.formvalue(sid);
            if (v2 && v2.length > 0 && v1 == v2)
                return L.system.setPassword('root', v2);
        };


        var s2 = m.section(L.cbi.TypedSection, 'dropbear', {
            caption:     L.tr('SSH Server'),
            description: L.tr('This sections define listening instances of the builtin Dropbear SSH server'),
            addremove:   true,
            add_caption: L.tr('Add instance ...'),
            readonly:    !this.options.acls.admin
        });

        s2.option(L.cbi.NetworkList, 'Interface', {
            caption:     L.tr('Interface'),
            description: L.tr('Listen only on the given interface or, if unspecified, on all')
        });

        s2.option(L.cbi.InputValue, 'Port', {
            caption:     L.tr('Port'),
            description: L.tr('Specifies the listening port of this Dropbear instance'),
            datatype:    'port',
            placeholder: 22,
            optional:    true
        });

        s2.option(L.cbi.CheckboxValue, 'PasswordAuth', {
            caption:     L.tr('Password authentication'),
            description: L.tr('Allow SSH password authentication'),
            initial:     true,
            enabled:     'on',
            disabled:    'off'
        });

        s2.option(L.cbi.CheckboxValue, 'RootPasswordAuth', {
            caption:     L.tr('Allow root logins with password'),
            description: L.tr('Allow the root user to login with password'),
            initial:     true,
            enabled:     'on',
            disabled:    'off'
        });

        s2.option(L.cbi.CheckboxValue, 'GatewayPorts', {
            caption:     L.tr('Gateway ports'),
            description: L.tr('Allow remote hosts to connect to local SSH forwarded ports'),
            initial:     false,
            enabled:     'on',
            disabled:    'off'
        });


        var s3 = m.section(L.cbi.TableSection, '__keys', {
            caption:     L.tr('SSH-Keys'),
            description: L.tr('Here you can paste public SSH-Keys (one per line) for SSH public-key authentication.'),
            addremove:   true,
            add_caption: L.tr('Add key ...'),
            readonly:    !this.options.acls.admin
        });

        s3.sections = function()
        {
            var k = [ ];
            var l = this.keys ? this.keys.length : 0;

            for (var i = 0; i < (l || 1); i++)
                k.push({ '.name': i.toString() });

            return k;
        };

        s3.add    = function()    { this.keys.push('') };
        s3.remove = function(sid) { this.keys.splice(parseInt(sid), 1) };

        var c = s3.option(L.cbi.DummyValue, '__comment', {
            caption:     L.tr('Comment'),
            width:       '10%'
        });

        c.ucivalue = function(sid) {
            var key = (s3.keys[parseInt(sid)] || '').split(/\s+/) || [ ];
            return key[2] || '-';
        };

        var k = s3.option(L.cbi.InputValue, '__key', {
            caption:     L.tr('Public key line'),
            width:       '90%',
            datatype:    function(key, elem) {
                var elems = (key || '-').toString().split(/\s+/);

                $('#' + elem.attr('id').replace(/key$/, 'comment')).text(elems[2] || '');

                if (elems.length < 2 || elems[0].indexOf('ssh-') != 0 ||
                    !elems[1].match(/^(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/))
                    return L.tr('Must be a valid SSH pubkey');

                return true;
            }
        });

        k.load     = function(sid) { s3.keys = [ ]; return L.system.getSSHKeys().then(function(keys) { s3.keys = keys }) };
        k.save     = function(sid) { if (sid == '0') return L.system.setSSHKeys(s3.keys) };
        k.ucivalue = function(sid) { return s3.keys[parseInt(sid)] };

        return m.insertInto('#map');
    }
});
