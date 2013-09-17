L.ui.view.extend({
    title: L.tr('Processes'),
    description: L.tr('This list gives an overview over currently running system processes and their status.'),
    execute: function() {
        var allow_signals = this.options.acls.status;
        return L.system.getProcessList().then(function(list) {
            var procTable = new L.ui.table({
                columns: [ {
                    caption: L.tr('PID'),
                    key:     'pid'
                }, {
                    caption: L.tr('Owner'),
                    key:     'user'
                }, {
                    caption: L.tr('Command'),
                    key:     'command'
                }, {
                    caption: L.tr('CPU usage (%)'),
                    key:     'cpu_percent',
                    format:  '%d%%'
                }, {
                    caption: L.tr('Memory usage (%)'),
                    key:     'vsize_percent',
                    format:  '%d%%'
                }, {
                    key:    'pid',
                    format: function(v, n) {
                        return $('<button />')
                            .attr('disabled', !allow_signals)
                            .addClass('cbi-button')
                            .addClass('cbi-button-reload')
                            .text(L.tr('Hang Up'))
                            .click(function() { L.system.sendSignal(v, 1).then(status) });
                    }
                }, {
                    key:    'pid',
                    format: function(v, n) {
                        return $('<button />')
                            .attr('disabled', !allow_signals)
                            .addClass('cbi-button')
                            .addClass('cbi-button-remove')
                            .text(L.tr('Terminate'))
                            .click(function() { L.system.sendSignal(v, 15).then(status) });
                    }
                }, {
                    key:    'pid',
                    format: function(v, n) {
                        return $('<button />')
                            .attr('disabled', !allow_signals)
                            .addClass('cbi-button')
                            .addClass('cbi-button-reset')
                            .text(L.tr('Kill'))
                            .click(function() { L.system.sendSignal(v, 9).then(status); });
                    }
                } ]
            });

            procTable.rows(list);
            procTable.insertInto('#process_table');
        });
    }
});
