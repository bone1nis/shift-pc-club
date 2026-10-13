<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RussianMessagesTest extends TestCase
{
    use RefreshDatabase;

    private function csrf(): void
    {
        $this->withCredentials()->withHeader('Origin', config('shift.origin'));
        $csrf = $this->getJson('/api/auth/csrf')->assertOk()->json('data.csrf_token');
        $this->withUnencryptedCookie('XSRF-TOKEN', $csrf)->withHeader('X-CSRF-TOKEN', $csrf);
    }

    public function test_validation_errors_are_in_russian(): void
    {
        $this->csrf();
        $response = $this->postJson('/api/auth/register', ['name' => 'Игрок', 'email' => 'kto-to', 'password' => 'short'])->assertUnprocessable();
        $errors = $response->json('errors');
        self::assertSame('Пароль должен содержать не меньше 12 символов.', $errors['password'][0]);
        self::assertSame('Поле «электронная почта» должно быть корректным адресом электронной почты.', $errors['email'][0]);
        self::assertStringNotContainsString('field', json_encode($response->json(), JSON_UNESCAPED_UNICODE));
    }

    public function test_required_field_message_uses_a_russian_attribute_name(): void
    {
        $this->csrf();
        $this->postJson('/api/auth/login', [])->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Заполните поле «электронная почта».');
    }

    public function test_abort_messages_are_translated(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized()->assertJsonPath('message', 'Нужно войти в аккаунт.');
    }
}
