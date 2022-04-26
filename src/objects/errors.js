class RethrownError extends Error {
    constructor(message, error) {
        super(message);
        this.name = this.constructor.name;

        if (!error) return;

        this.originalError = error;
        this.originalStack = this.stack;
        const lines = (this.message.match(/\n/g) || []).length + 1;
        this.stack =
            this.stack
                .split("\n")
                .slice(0, lines + 1)
                .join("\n") +
            "\n" +
            error.stack;
    }
}

export class ClientError extends RethrownError {}
export class LoginError extends RethrownError {}
export class MessageError extends RethrownError {}
export class WebsocketError extends RethrownError {}
