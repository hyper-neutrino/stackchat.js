export class Jar {
    constructor(jar = undefined) {
        this.jar = jar ?? [];
    }

    clear() {
        this.jar = [];
    }

    getCookies(domain) {
        return this.jar
            .filter((cookie) =>
                cookie.domain[0] == "."
                    ? domain.endsWith(cookie.domain.slice(1))
                    : domain == cookie.domain
            )
            .map((cookie) => `${cookie.name}=${cookie.data}`)
            .join("; ");
    }

    addCookie(domain, cookie) {
        const parts = cookie.split("; ");
        let d = parts.find((part) => part.toLowerCase().startsWith("domain="));

        if (d) {
            d = d.split("=")[1];
            if (!d.startsWith(".")) d = "." + d;
        } else {
            d = domain;
        }

        const name = parts[0].split("=")[0];
        const data = parts[0].slice(name.length + 1);

        const c = this.jar.find(
            (cookie) => cookie.domain == d && cookie.name == name
        );

        if (c) c.data = data;
        else this.jar.push({ domain: d, name, data });
    }

    exportJar() {
        return this.jar.slice();
    }

    importJar(jar) {
        for (const cookie of jar) this.jar.push(cookie);
    }
}
