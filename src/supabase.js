import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cxjtbupdfxxsvcardxtq.supabase.co'
const SUPABASE_KEY = 'sb_publishable_UdB4ZFk1k_m5rbfSrc47cQ_JsgkUpmX'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)