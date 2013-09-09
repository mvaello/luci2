/*
 * luci-io - LuCI non-RPC helper
 *
 *   Copyright (C) 2013 Jo-Philipp Wich <jow@openwrt.org>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

#include "login.h"


enum {
	SES_NEW_SID,
	__SES_NEW_MAX,
};

static const struct blobmsg_policy ses_new_policy[__SES_NEW_MAX] = {
	[SES_NEW_SID] = { .name = "sid", .type = BLOBMSG_TYPE_STRING },
};

static bool
parse_acl_scope(struct blob_attr *acl_perm, struct blob_attr *acl_scope,
                struct blob_buf *req)
{
    struct blob_attr *acl_obj, *acl_func;
    int rem, rem2;
    void *c, *d;

    if (!strcmp(blobmsg_name(acl_scope), "ubus") &&
        blob_id(acl_scope) == BLOBMSG_TYPE_TABLE)
    {
        blobmsg_add_string(req, "scope", blobmsg_name(acl_scope));
        c = blobmsg_open_array(req, "objects");

        blobmsg_for_each_attr(acl_obj, acl_scope, rem)
        {
            if (blob_id(acl_obj) != BLOBMSG_TYPE_ARRAY)
                continue;

            blobmsg_for_each_attr(acl_func, acl_obj, rem2)
            {
                if (blob_id(acl_func) != BLOBMSG_TYPE_STRING)
                    continue;

                d = blobmsg_open_array(req, NULL);
                blobmsg_add_string(req, NULL, blobmsg_name(acl_obj));
                blobmsg_add_string(req, NULL, blobmsg_data(acl_func));
                blobmsg_close_array(req, d);
            }
        }

        blobmsg_close_array(req, c);
        return true;
    }
    else if ((!strcmp(blobmsg_name(acl_scope), "uci") ||
              !strcmp(blobmsg_name(acl_scope), "luci-io")) &&
             blob_id(acl_scope) == BLOBMSG_TYPE_ARRAY)
    {
        blobmsg_add_string(req, "scope", blobmsg_name(acl_scope));
        c = blobmsg_open_array(req, "objects");

        blobmsg_for_each_attr(acl_obj, acl_scope, rem)
        {
            if (blob_id(acl_obj) != BLOBMSG_TYPE_STRING)
                continue;

			d = blobmsg_open_array(req, NULL);
            blobmsg_add_string(req, NULL, blobmsg_data(acl_obj));
            blobmsg_add_string(req, NULL, blobmsg_name(acl_perm));
            blobmsg_close_array(req, d);
        }

        blobmsg_close_array(req, c);
        return true;
    }

    return false;
}

static struct uci_section *
test_user_access(struct uci_context *uci, const char *user)
{
    struct uci_package *p;
    struct uci_section *s;
	struct uci_element *e;
    struct uci_ptr ptr = { .package = "luci", .option = "user" };

	uci_load(uci, ptr.package, &p);

	if (!p)
		return false;

    uci_foreach_element(&p->sections, e)
    {
        s = uci_to_section(e);

        if (strcmp(s->type, "access"))
            continue;

        ptr.section = s->e.name;
        ptr.s = NULL;
        ptr.o = NULL;

        if (uci_lookup_ptr(uci, &ptr, NULL, true))
            continue;

        if (ptr.o->type != UCI_TYPE_STRING)
            continue;

        if (strcmp(ptr.o->v.string, user))
            continue;

		return ptr.s;
    }

    return NULL;
}

static bool
test_group_access(struct uci_section *s, const char *perm, const char *group)
{
	struct uci_option *o;
	struct uci_element *e, *l;

	uci_foreach_element(&s->options, e)
	{
		o = uci_to_option(e);

		if (o->type != UCI_TYPE_LIST)
			continue;

		if (strcmp(o->e.name, perm))
			continue;

		uci_foreach_element(&o->v.list, l)
			if (l->name && !fnmatch(l->name, group, 0))
				return true;
	}

	if (!strcmp(perm, "read"))
		return test_group_access(s, "write", group);

	return false;
}

static void
setup_session_cb(struct ubus_request *req, int type, struct blob_attr *msg)
{
	struct blob_attr *tb[__SES_NEW_MAX];
    const char **sid = req->priv;

	if (!msg)
		return;

	blobmsg_parse(ses_new_policy, __SES_NEW_MAX, tb,
                  blob_data(msg), blob_len(msg));

	if (tb[SES_NEW_SID])
		*sid = strdup(blobmsg_data(tb[SES_NEW_SID]));
}

const char *
setup_session(const char *user)
{
    uint32_t id;
    struct blob_buf req = { 0 }, acl = { 0 };
    struct blob_attr *acl_group, *acl_perm, *acl_scope;
    struct ubus_context *ctx = NULL;
    struct uci_context *uci = NULL;
	struct uci_section *access;
    const char *sid = NULL;
    int i, rem, rem2, rem3;
    void *c, *d;
    glob_t gl;

    uci = uci_alloc_context();

    if (!uci)
        goto out;

	access = test_user_access(uci, user);

    /* continue without access group if user is root (backward compat) */
	if (!access && strcmp(user, "root"))
		goto out;

    ctx = ubus_connect(NULL);

    if (!ctx || ubus_lookup_id(ctx, "session", &id))
        goto out;

    blob_buf_init(&req, 0);
    blobmsg_add_u32(&req, "timeout", 3600);
    ubus_invoke(ctx, id, "create", req.head, setup_session_cb, &sid, 500);

    if (!sid)
        goto out;

    blob_buf_init(&req, 0);
    blobmsg_add_string(&req, "sid", sid);
    c = blobmsg_open_table(&req, "values");
    blobmsg_add_string(&req, "user", user);
    blobmsg_close_table(&req, c);
    ubus_invoke(ctx, id, "set", req.head, NULL, NULL, 500);

    if (glob("/usr/share/luci2/acl.d/*.json", 0, NULL, &gl))
        goto out;

    for (i = 0; i < gl.gl_pathc; i++)
    {
        blob_buf_init(&acl, 0);

        if (!blobmsg_add_json_from_file(&acl, gl.gl_pathv[i]))
        {
            fprintf(stderr, "Failed to parse %s\n", gl.gl_pathv[i]);
            continue;
        }

        blob_for_each_attr(acl_group, acl.head, rem)
        {
			blobmsg_for_each_attr(acl_perm, acl_group, rem2)
            {
                if (blob_id(acl_perm) != BLOBMSG_TYPE_TABLE)
                    continue;

                if (strcmp(blobmsg_name(acl_perm), "read") &&
                    strcmp(blobmsg_name(acl_perm), "write"))
                    continue;

				if (access != NULL &&
                    !test_group_access(access, blobmsg_name(acl_perm),
				                               blobmsg_name(acl_group)))
					continue;

                blobmsg_for_each_attr(acl_scope, acl_perm, rem3)
                {
                    blob_buf_init(&req, 0);

                    if (!parse_acl_scope(acl_perm, acl_scope, &req))
                        continue;

                    blobmsg_add_string(&req, "sid", sid);
                    ubus_invoke(ctx, id, "grant", req.head, NULL, NULL, 500);


                    blob_buf_init(&req, 0);
                    blobmsg_add_string(&req, "sid", sid);
                    blobmsg_add_string(&req, "scope", "luci-ui");
                    c = blobmsg_open_array(&req, "objects");
                    d = blobmsg_open_array(&req, NULL);
                    blobmsg_add_string(&req, NULL, blobmsg_name(acl_group));
                    blobmsg_add_string(&req, NULL, blobmsg_name(acl_perm));
                    blobmsg_close_array(&req, d);
                    blobmsg_close_array(&req, c);
                    ubus_invoke(ctx, id, "grant", req.head, NULL, NULL, 500);
                }
            }
        }
    }

	globfree(&gl);

out:
	if (uci)
		uci_free_context(uci);

    if (ctx)
        ubus_free(ctx);

    return sid;
}
