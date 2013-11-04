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
                        return $('<div />')
                            .addClass('btn-group')
                            .append($('<button />')
                                .addClass('btn btn-primary btn-sm dropdown-toggle')
                                .attr('data-toggle', 'dropdown')
                                .text(L.tr('Signal…')))
                            .append($('<ul />')
                                .addClass('dropdown-menu pull-right')
                                .append($('<li />')
                                    .append($('<a />')
                                        .attr('href', '#')
                                        .html('%s (<code>%s</code>)'.format(L.trc('UNIX signal', 'Reload'), 'HUP'))
                                        .click(function(ev) { L.system.sendSignal(v, 1).then(status); ev.preventDefault(); })))
                                .append($('<li />')
                                    .append($('<a />')
                                        .attr('href', '#')
                                        .html('%s (<code>%s</code>)'.format(L.trc('UNIX signal', 'Terminate'), 'TERM'))
                                        .click(function(ev) { L.system.sendSignal(v, 15).then(status); ev.preventDefault(); })))
                                .append($('<li />')
                                    .append($('<a />')
                                        .attr('href', '#')
                                        .html('%s (<code>%s</code>)'.format(L.trc('UNIX signal', 'Kill immediately'), 'KILL'))
                                        .click(function(ev) { L.system.sendSignal(v, 9).then(status); ev.preventDefault(); }))))
                    }
                } ]
            });

            procTable.rows(list);
            procTable.insertInto('#process_table');
        });
    }
});
