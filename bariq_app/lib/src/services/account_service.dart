import 'package:supabase_flutter/supabase_flutter.dart';

class AccountService {
  AccountService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  User? get user => _client.auth.currentUser;

  Future<AuthResponse> signIn(String email, String password) =>
      _client.auth.signInWithPassword(email: email.trim(), password: password);

  Future<AuthResponse> signUp(String email, String password) =>
      _client.auth.signUp(email: email.trim(), password: password);

  Future<void> signOut() => _client.auth.signOut();

  Future<List<Map<String, dynamic>>> fetchOrders() async {
    final u = user;
    if (u == null) return [];
    try {
      final rows = await _client
          .from('orders')
          .select()
          .eq('user_id', u.id)
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(rows);
    } catch (_) {
      final email = u.email;
      if (email == null) return [];
      final rows = await _client
          .from('orders')
          .select()
          .eq('email', email)
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(rows);
    }
  }
}
