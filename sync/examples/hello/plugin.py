from ffsync.api import Batch, Context


class Hello:
    def fetch(self, ctx: Context) -> Batch:
        ctx.spend()
        ctx.log("hello", greeting=ctx.setting("greeting", "hi"), since=str(ctx.since))
        return Batch()


plugin = Hello()
