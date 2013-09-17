L.ui.view.extend({
    title: L.tr('Startup'),
    execute: function() {
        var self = this;
        var redraw = function() { return self.execute(); };
        var allow_write = self.options.acls.startup;

        return $.when(
            L.system.initList().then(function(list) {
                /* filter init scripts with no start prio */
                for (var i = 0; i < list.length; i++)
                {
                    if (typeof(list[i].start) != 'undefined')
                        continue;

                    list.splice(i--, 1);
                }

                var initTable = new L.ui.table({
                    columns: [ {
                        caption: L.tr('Start priority'),
                        key:     'start'
                    }, {
                        caption: L.tr('Initscript'),
                        key:     'name',
                        width:   '90%'
                    }, {
                        caption: L.trc('Init script table heading', 'Enable'),
                        key:     'enabled',
                        format: function(v, n) {
                            return $('<button />')
                                .attr('disabled', !allow_write)
                                .attr('name', list[n].name)
                                .addClass('cbi-button')
                                .addClass(v ? 'cbi-button-apply' : 'cbi-button-reset')
                                .text(v ? L.trc('Init script state', 'Enabled') : L.trc('Init script state', 'Disabled'))
                                .click(function() {
                                    L.ui.loading(true);
                                    if (v)
                                        L.system.initDisable(this.getAttribute('name')).then(redraw);
                                    else
                                        L.system.initEnable(this.getAttribute('name')).then(redraw);
                                });
                        }
                    }, {
                        caption: L.trc('Init script table heading', 'Restart'),
                        key:     'enabled',
                        format: function(v, n) {
                            return $('<button />')
                                .attr('disabled', !allow_write)
                                .attr('name', list[n].name)
                                .addClass('cbi-button')
                                .addClass('cbi-button-reload')
                                .text(L.trc('Init script action', 'Restart'))
                                .click(function() {
                                    L.ui.loading(true);
                                    L.system.initRestart(this.getAttribute('name')).then(redraw)
                                });
                        }
                    }, {
                        caption: L.trc('Init script table heading', 'Stop'),
                        key:     'enabled',
                        format: function(v, n) {
                            return $('<button />')
                                .attr('disabled', !allow_write)
                                .attr('name', list[n].name)
                                .addClass('cbi-button')
                                .addClass('cbi-button-remove')
                                .text(L.trc('Init script action', 'Stop'))
                                .click(function() {
                                    L.ui.loading(true);
                                    L.system.initStop(this.getAttribute('name')).then(redraw)
                                });
                        }
                    } ]
                });

                initTable.rows(list);
                initTable.insertInto('#init_table');

                L.ui.loading(false);
            }),
            L.system.getRcLocal().then(function(data) {
                $('#maps').accordion({ heightStyle: 'content' });

                $('textarea').val(data).attr('disabled', !allow_write);
                $('input.cbi-button-save').attr('disabled', !allow_write).click(function() {
                    var data = ($('textarea').val() || '').replace(/\r/g, '').replace(/\n?$/, '\n');
                    L.ui.loading(true);
                    L.system.setRcLocal(data).then(function() {
                        $('textarea').val(data);
                        L.ui.loading(false);
                    });
                });
            })
        );
    }
});
