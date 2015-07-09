odoo.define('account_reports.FollowupReportWidget', function (require) {
'use strict';

var core = require('web.core');
var Model = require('web.Model');
var formats = require('web.formats');
var ReportWidget = require('account_reports.ReportWidget');
var time = require('web.time');

var QWeb = core.qweb;

var FollowupReportWidget = ReportWidget.extend({
    events: _.defaults({
        'click .change_exp_date': 'displayExpNoteModal',
        'click #savePaymentDate': 'changeExpDate',
        'click .followup-email': 'sendFollowupEmail',
        'click .followup-letter': 'printFollowupLetter',
        'click .o_account_reports_followup_skip': 'skipPartner',
        'click .o_account_reports_followup_done': 'donePartner',
        'click .o_account_reports_followup-auto': 'enableAuto',
        "change *[name='blocked']": 'onChangeBlocked',
        'click .o_account_reports_set-next-action': 'setNextAction',
        'click #saveNextAction': 'saveNextAction',
        'click .o_account_reports_followup-set-next-action': 'setNextAction',
    }, ReportWidget.prototype.events),
    saveNextAction: function(e) {
        e.stopPropagation();
        e.preventDefault();
        var note = $(".o_account_reports_next_action_note").val().replace(/\r?\n/g, '<br />').replace(/\s+/g, ' ');
        var target_id = $("#nextActionModal #target_id").val();
        var date = $("#nextActionDate").val();
        date = formats.parse_value(date, {type:'date'})
        return new Model('account.report.context.followup').call('change_next_action', [[parseInt(target_id)], date, note]).then(function (result) {
            this.$('#nextActionModal').modal('hide');
            this.$('div.o_account_reports_page.' + target_id).find('.o_account_reports_next-action').html(QWeb.render("nextActionDate", {'note': note, 'date': date}));
        });
    },
    enableAuto: function(e) {
        var target_id;
        if ($(e.target).is('.btn-default')) { // change which button is highlighted
            target_id = $(e.target).parents("div.o_account_reports_page").data('context');
            $(e.target).toggleClass('btn-default btn-info');
            $(e.target).siblings().toggleClass('btn-default btn-info');
            $(e.target).parents("div.o_account_reports_page").find('.o_account_reports_followup-no-action').remove();
        }
        else if ($(e.target).is('div.alert a')) {
            target_id = $("div.o_account_reports_page").data('context');
            this.$("div.o_account_reports_page").find('div#followup-mode .o_account_reports_followup-auto').addClass('btn-info');
            this.$("div.o_account_reports_page").find('div#followup-mode .o_account_reports_followup-auto').removeClass('btn-default');
            this.$("div.o_account_reports_page").find('div#followup-mode .o_account_reports_followup-manual').addClass('btn-default');
            this.$("div.o_account_reports_page").find('div#followup-mode .o_account_reports_followup-manual').removeClass('btn-info');
            this.$('.o_account_reports_followup-no-action').remove();
        }
        return new Model('account.report.context.followup').call('to_auto', [[parseInt(target_id)]])
    },
    setNextAction: function(e) {
        e.stopPropagation();
        e.preventDefault();
        if ($(e.target).is('.o_account_reports_followup-manual.btn-default')){
            $(e.target).toggleClass('btn-default btn-info');
            $(e.target).siblings().toggleClass('btn-default btn-info');
        }
        if ($(e.target).parents("div.o_account_reports_page").length > 0) {
            var target_id = $(e.target).parents("div.o_account_reports_page").data('context');
            this.$("#nextActionModal #target_id").val(target_id);
        }
        var dt = new Date();
        switch($(e.target).data('time')) {
            case 'one-week':
                dt.setDate(dt.getDate() + 7);
                break;
            case 'two-weeks':
                dt.setDate(dt.getDate() + 14);
                break;
            case 'one-month':
                dt.setMonth(dt.getMonth() + 1);
                break;
            case 'two-months':
                dt.setMonth(dt.getMonth() + 2);
                break;
        }
        this.$('.o_account_reports_picker-next-action-date').data("DateTimePicker").setValue(moment(dt));
        this.$('#nextActionModal').on('hidden.bs.modal', function (e) {
            $(this).find('form')[0].reset();
        });
        this.$('#nextActionModal').modal('show');
    },
    onChangeBlocked: function(e) {
        e.stopPropagation();
        e.preventDefault();
        var checkbox = $(e.target).is(":checked")
        var target_id = $(e.target).parents('tr').data('id');
        if (checkbox) {
            $(e.target).parents('tr').attr('bgcolor', 'LightGray');
        }
        else {
            $(e.target).parents('tr').attr('bgcolor', 'white');
        }
        return new Model('account.move.line').call('write', [[parseInt(target_id)], {'blocked': checkbox}])
    },
    onKeyPress: function(e) {
        var report_name = $("div.o_account_reports_page").data("report-name");
        if ((e.which === 13 || e.which === 10) && (e.ctrlKey || e.metaKey) && report_name == 'followup_report') {
            var letter_context_list = [];
            var email_context_list = [];
            this.$("*[data-primary='1'].followup-email").each(function() {
                email_context_list.push($(this).data('context'))
            });
            this.$("*[data-primary='1'].followup-letter").each(function() {
                letter_context_list.push($(this).data('context'))
            });
            window.open('?pdf&letter_context_list=' + letter_context_list, '_blank');
            var report_context = {partner_done: 'all', email_context_list: email_context_list}; // Restart the report
            this.getParent().restart(report_context);
        }
    },
    donePartner: function(e) {
        var partner_id = $(e.target).data("partner");
        var self = this;
        return new Model('res.partner').call('update_next_action', [[parseInt(partner_id)]]).then(function (result) {
            var report_context = {partner_done: partner_id}; // Restart the report
            self.getParent().restart(report_context);
        });
    },
    skipPartner: function(e) {
        var partner_id = $(e.target).data("partner");
        var report_context = {partner_skipped: partner_id}; // Restart the report
        this.getParent().restart(report_context);
    },
    printFollowupLetter: function(e) {
        e.stopPropagation();
        e.preventDefault();
        var url = $(e.target).data("target");
        window.open(url, '_blank');
        if ($(e.target).data('primary') == '1') {
            $(e.target).parents('#action-buttons').addClass('o_account_reports_followup_clicked');
            $(e.target).toggleClass('btn-primary btn-default');
            $(e.target).data('primary', '0');
        }
    },
    sendFollowupEmail: function(e) {
        e.stopPropagation();
        e.preventDefault();
        var context_id = $(e.target).parents("div.o_account_reports_page").attr("data-context");
        return new Model('account.report.context.followup').call('send_email', [[parseInt(context_id)]]).then (function (result) {
            if (result == true) {
                window.$("div.o_account_reports_page:first").prepend(QWeb.render("emailSent"));
                if ($(e.target).data('primary') == '1') {
                    $(e.target).parents('#action-buttons').addClass('o_account_reports_followup_clicked');
                    $(e.target).toggleClass('btn-primary btn-default');
                    $(e.target).data('primary', '0');
                }
            }
            else {
                window.$("div.o_account_reports_page:first").prepend(QWeb.render("emailNotSent"));
            }
        });
    },
    displayExpNoteModal: function(e) {
        e.stopPropagation();
        e.preventDefault();
        var target_id = $(e.target).parents('tr').data('id');
        this.$("#paymentDateLabel").text($(e.target).parents("div.dropdown").find("span.invoice_id").text());
        this.$("#paymentDateModal #target_id").val(target_id);
        this.$('#paymentDateModal').on('hidden.bs.modal', function (e) {
            $(this).find('form')[0].reset();
        });
        this.$('#paymentDateModal').modal('show');
    },
    changeExpDate: function(e) {
        e.stopPropagation();
        e.preventDefault();
        var note = this.$("#internalNote").val().replace(/\r?\n/g, '<br />').replace(/\s+/g, ' ');
        return new Model('account.move.line').call('write', [[parseInt(this.$("#paymentDateModal #target_id").val())], {expected_pay_date: formats.parse_value(this.$("#expectedDate").val(), {type:'date'}), internal_note: note}]).then(function (result) {
            this.$('#paymentDateModal').modal('hide');
            this.getParent().restart({});
        });
    },
    clickPencil: function(e) {
        e.stopPropagation();
        e.preventDefault();
        self = this;
        if ($(e.target).parent().hasClass('o_account_reports_next-action')) {
            self.setNextAction(e);
        }
        return this._super()
    },
    start: function() {
        $(document).on("keypress", this, this.onKeyPress);
        var l10n = core._t.database.parameters;
        var $datetimepickers = this.$('.o_account_reports_datetimepicker');
        var options = {
            language : moment.locale(),
            format : time.strftime_to_moment_format(l10n.date_format),
            icons: {
                date: "fa fa-calendar",
            },
            pickTime: false,
        }
        $datetimepickers.each(function () {
            $(this).datetimepicker(options);
        })
        return this._super();
    },

});

return FollowupReportWidget;
});