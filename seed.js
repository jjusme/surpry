import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const usersToCreate = [
    { email: 'ana@surpry.local', password: 'password123', display_name: 'Ana Lopez' },
    { email: 'carlos@surpry.local', password: 'password123', display_name: 'Carlos Ruiz' },
    { email: 'sofia@surpry.local', password: 'password123', display_name: 'Sofia Mora', birthday_day: 5, birthday_month: 12 }
];

async function seed() {
    console.log("🌱 Iniciando creación de usuarios de prueba...");

    const createdUsers = [];

    for (const u of usersToCreate) {
        // 1. Create auth user
        const { data: user, error } = await supabase.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { display_name: u.display_name }
        });

        if (error) {
            if (error.message.includes('already registered')) {
                console.log(`⚠️  El usuario ${u.email} ya existe, saltando creación...`);
                // If exists, fetch the user ID by using identity or skipping
                // We'll just continue
            } else {
                console.error(`❌ Error creando ${u.email}:`, error.message);
            }
        } else {
            console.log(`✅ Creado usuario: ${u.email} (${user.user.id})`);
            createdUsers.push(user.user);

            // Additional profile updates (birthday)
            if (u.birthday_day) {
                // Wait briefly for trigger to complete
                await new Promise(r => setTimeout(r, 1000));
                await supabase.from('profiles').update({
                    birthday_day: u.birthday_day,
                    birthday_month: u.birthday_month
                }).eq('id', user.user.id);
            }
        }
    }

    // Si creamos a Ana, Carlos y Sofia, haremos un grupo
    if (createdUsers.length === 3) {
        console.log("\n📦 Creando grupo de prueba...");
        const anaId = createdUsers[0].id;
        const carlosId = createdUsers[1].id;
        const sofiaId = createdUsers[2].id;

        // Crear grupo
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .insert({ name: 'Amigos Cercanos', created_by: anaId })
            .select()
            .single();

        if (groupError) {
            console.error("❌ Error creando grupo:", groupError);
            return;
        }

        // Agregar miembros
        await supabase.from('group_members').insert([
            { group_id: group.id, user_id: anaId, role: 'admin' },
            { group_id: group.id, user_id: carlosId, role: 'member' },
            { group_id: group.id, user_id: sofiaId, role: 'member' }
        ]);
        console.log(`✅ Grupo '${group.name}' creado y miembros agregados.`);

        // Crear un evento sorpresa para Sofia organizado por Ana
        console.log("\n🎉 Creando evento sorpresa para Sofia...");
        const { data: event, error: eventError } = await supabase.rpc('create_manual_birthday_event', {
            p_group_id: group.id,
            p_birthday_user_id: sofiaId
        });

        if (eventError) {
            // Since the RPC expects to be called BY the actual user (uses auth.uid()), calling it via service_role might fail because auth.uid() is null for service role.
            // Let's create it manually since we are admin:
            const currentYear = new Date().getFullYear();
            const { data: bEvent, error: mError } = await supabase.from('birthday_events').insert({
                group_id: group.id,
                birthday_user_id: sofiaId,
                organizer_id: anaId,
                birthday_date: `${currentYear}-12-05`,
                event_year: currentYear,
                status: 'draft'
            }).select().single();

            if (bEvent) {
                await supabase.from('event_participants').insert([
                    { event_id: bEvent.id, user_id: anaId, role: 'organizer' },
                    { event_id: bEvent.id, user_id: carlosId, role: 'participant' }
                ]);
                console.log(`✅ Evento sorpresa (ID: ${bEvent.id}) creado! Ana y Carlos son participantes.`);
            }
        } else {
            // If RPC somehow worked
            console.log(`✅ Evento sorpresa creado!`);
        }

        console.log("\n🚀 ¡TODO LISTO! Usa las siguientes credenciales para probar:");
        console.log("-----------------------------------------");
        console.log("Ana (Admin/Organizadora): ana@surpry.local / password123");
        console.log("Carlos (Cómplice): carlos@surpry.local / password123");
        console.log("Sofia (Cumpleañera): sofia@surpry.local / password123");
    } else {
        console.log("\n🚀 Usuarios listos. Si ya existían, ignora el paso del grupo.");
        console.log("Ana: ana@surpry.local / password123");
        console.log("Carlos: carlos@surpry.local / password123");
        console.log("Sofia: sofia@surpry.local / password123");
    }
}

seed().catch(console.error);
