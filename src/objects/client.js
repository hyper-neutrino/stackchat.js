import { loadCredentials, saveCredentials } from "../lib/credentials.js";
import request from "../lib/request.js";
import { Jar } from "../lib/jar.js";
import { ClientError, LoginError, MessageError } from "./errors.js";
import { Room } from "./room.js";

export class Client {
    constructor() {
        this.jar = new Jar();
        this.fkey = null;
        this.rooms = new Map();
        this.listeners = new Map();
        this.queue = [];
        this.busy = false;
    }

    async request(url, { payload, headers, options } = {}) {
        return await request(url, { payload, headers, options, jar: this.jar });
    }

    async login(site, email, password) {
        if (this.fkey) {
            throw new ClientError("Client is already logged in.");
        }

        const oldCredentials = loadCredentials(site, email, password);

        if (!oldCredentials) {
            let fkey, res;

            res = await this.request(
                "https://openid.stackexchange.com/account/login"
            );

            try {
                fkey = res.body.match(
                    /<input type="hidden" name="fkey" value="([0-9a-z-]*)" \/>/
                )[1];
            } catch {
                throw new LoginError(
                    "Unexpected error obtaining fkey from OpenID login."
                );
            }

            res = await this.request(
                `https://${site}.stackexchange.com/users/login-or-signup/validation/track`,
                {
                    payload: {
                        email,
                        password,
                        fkey,
                        isSignup: false,
                        isLogin: true,
                        isPassword: false,
                        isAddLogin: false,
                        hasCaptcha: false,
                        ssrc: "head",
                        submitButton: "Log in",
                    },
                }
            );

            if (res.body.indexOf("Login-OK") == -1) {
                throw new LoginError("validation error");
            }

            res = await this.request(
                `https://${site}.stackexchange.com/users/login?ssrc=head&returnurl=https%3a%2f%2f${site}.stackexchange.com%2f`,
                { payload: { email, password, fkey, ssrc: "head" } }
            );

            if (res.body.indexOf("Human verification") != -1) {
                throw new LoginError("stopped by CAPTCHA");
            }

            if (res.body.indexOf("logout") == -1) {
                throw new LoginError(
                    "per-site failure (possibly invalid credentials)"
                );
            }

            try {
                res = await this.request(
                    "https://chat.stackexchange.com/chats/join/favorite"
                );

                fkey = res.body.match(
                    /<input id="fkey" name="fkey" type="hidden" value="([0-9a-z]*)" \/>/
                )[1];
            } catch {
                throw new LoginError("could not fetch chat fkey");
            }

            saveCredentials(site, email, password, {
                jar: this.jar.exportJar(),
                fkey,
            });

            this.fkey = fkey;
        } else {
            this.jar.importJar(oldCredentials.jar);
            this.fkey = oldCredentials.fkey;
        }
    }

    async logout() {
        if (!this.fkey) {
            throw new ClientError("Client is not logged in.");
        }

        this.jar.clear();
        this.fkey = null;
    }

    async joinRoom(id, { messageCacheLimit } = {}) {
        let room;

        if (this.rooms.has(id)) {
            room = this.rooms.get(id);
            room.messages.max = messageCacheLimit;
            return room;
        }

        room = new Room(this, id, { messageCacheLimit });
        await room.connectWs();
        this.rooms.set(id, room);

        return room;
    }

    runQueue() {
        const next = this.queue[0];

        if (!next) {
            this.busy = false;
            return;
        }

        const { url, options, resolve } = next;

        this.request(url, options).then((res) => {
            const match = res.body.match(
                /You can perform this action again in (\d+) seconds?./
            );

            if (match) {
                setTimeout(
                    () => this.runQueue(),
                    parseInt(match[1]) * 1000 + 250
                );
            } else {
                this.queue.shift();
                resolve(res);
                this.runQueue();
            }
        });
    }

    async queueRequest(url, options) {
        return new Promise((resolve) => {
            this.queue.push({ url, options, resolve });

            if (!this.busy) {
                this.busy = true;
                this.runQueue();
            }
        });
    }

    async send(room, content) {
        const res = await this.queueRequest(
            `https://chat.stackexchange.com/chats/${room}/messages/new`,
            {
                payload: {
                    fkey: this.fkey,
                    text: content,
                },
                headers: {
                    Referer: `https://chat.stackexchange.com/rooms/${room}`,
                    Origin: "https://chat.stackexchange.com",
                },
            }
        );

        if (res.body.indexOf("The message is too long") != -1) {
            throw new MessageError("message is too long");
        }

        return res;
    }

    on(event, listener) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(listener);
    }

    trigger(event, ...data) {
        for (const listener of this.listeners.get(event) ?? []) {
            listener(...data);
        }
    }
}
