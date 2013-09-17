L.ui.view.extend({
    title: L.tr('Kernel Log'),
    refresh: 5000,
    execute: function() {
        return L.system.getKernelLog().then(function(log) {
            var ta = document.getElementById('syslog');
            var lines = log.replace(/\n+$/, '').split(/\n/);

            ta.rows = lines.length;
            ta.value = lines.reverse().join("\n");
        });
    }
});
