// Slack message layout for an invoice. Used by both n8n workflows:
// workflow 1 posts it with Approve/Reject buttons, workflow 2 replaces the
// buttons with the decision. Pasted into Code nodes by scripts/build_n8n_workflow.py.

function money(value, currency) {
  if (value === null || value === undefined) return '-';
  const amount = Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
}

const STATUS_LABELS = {
  ready_for_approval: ':white_check_mark: Ready for approval',
  needs_review: ':eyes: Needs review',
  flagged: ':triangular_flag_on_post: Flagged',
  approved: ':white_check_mark: Approved',
  rejected: ':x: Rejected',
  posted: ':ledger: Posted to Xero',
  failed: ':warning: Failed',
};

function invoiceBlocks(inv, decisionText) {
  const flags = inv.flags || [];
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Invoice ${inv.invoice_number || '(no number)'} from ${inv.vendor_name_raw || 'unknown vendor'}`.slice(0, 150),
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Total*\n${money(inv.total, inv.currency)}` },
        { type: 'mrkdwn', text: `*Due*\n${inv.due_date || '-'}` },
        { type: 'mrkdwn', text: `*PO*\n${inv.po_number || 'none'}` },
        { type: 'mrkdwn', text: `*Status*\n${STATUS_LABELS[inv.status] || inv.status}` },
      ],
    },
  ];

  if (flags.length) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*Problems found*\n' + flags.map(f => `• ${f.message}`).join('\n') },
    });
  }
  if (inv.unsure_fields) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `AI was unsure about: ${inv.unsure_fields}` }] });
  }

  const context = [`File: ${inv.file_name || '-'}`, `Source: ${inv.source}`];
  if (inv.source === 'upload') context.push('Demo upload: approving will not post to Xero');
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: context.join('  |  ') }] });

  if (decisionText) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: decisionText } });
    return blocks;
  }

  const approve = {
    type: 'button',
    action_id: 'approve_invoice',
    style: 'primary',
    value: inv.id,
    text: { type: 'plain_text', text: flags.length ? 'Approve anyway' : 'Approve' },
  };
  if (flags.length) {
    approve.confirm = {
      title: { type: 'plain_text', text: 'Approve a flagged invoice?' },
      text: { type: 'mrkdwn', text: 'This invoice has problems listed above. Approve it anyway?' },
      confirm: { type: 'plain_text', text: 'Approve' },
      deny: { type: 'plain_text', text: 'Cancel' },
    };
  }
  blocks.push({
    type: 'actions',
    block_id: 'invoice_decision',
    elements: [
      approve,
      { type: 'button', action_id: 'reject_invoice', style: 'danger', value: inv.id, text: { type: 'plain_text', text: 'Reject' } },
    ],
  });
  return blocks;
}
