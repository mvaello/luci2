L.ui.view.extend({
	title: L.tr('Scheduled Tasks'),
	description: L.tr('This is the system crontab in which scheduled tasks can be defined.'),
    execute: function() {
        var allow_write = this.options.acls.cron;

        return L.system.getCrontab().then(function(data) {
			$('textarea').val(data).attr('disabled', !allow_write);
			$('input.cbi-button-save').attr('disabled', !allow_write).click(function() {
				var data = ($('textarea').val() || '').replace(/\r/g, '').replace(/\n?$/, '\n');
				L.ui.loading(true);
				L.system.setCrontab(data).then(function() {
					$('textarea').val(data);
					L.ui.loading(false);
				});
			});
		});
    }
});
