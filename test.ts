import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: techs, error } = await supabase.from('techs').select('*');
  
  if (error) {
    console.error("Error fetching techs:", error);
  } else if (techs) {
    for (const tech of techs) {
      console.log(`Tech: ${tech.name}`);
      console.log(`Signature: ${tech.signature?.substring(0, 50)}...`);
      console.log(`Card: ${tech.saqcc_card_photo?.substring(0, 50)}...`);
    }
  } else {
    console.log("No techs found");
  }
}

test();





















