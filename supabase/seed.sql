-- Local-only runtime capability. Never apply this seed to a hosted project.
update private.runtime_flags set enabled = true where key = 'allow_self_bootstrap';

-- Create the first local account through /login; PTA OS then bootstraps its
-- workspace and catalogs through the authenticated local-only RPC.
