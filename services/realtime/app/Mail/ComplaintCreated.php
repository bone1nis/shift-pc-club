<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Письмо владельцу о новой жалобе: только номер и ссылка, текста жалобы сервер не знает. */
class ComplaintCreated extends Mailable
{
    public function __construct(public int $complaintId, public string $link) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Новая жалоба или отзыв');
    }

    public function content(): Content
    {
        return new Content(text: 'mail.complaint-created');
    }
}
