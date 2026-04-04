import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:dear_baby/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('health endpoint returns ok', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    // Find and tap the "Check Health" button
    final button = find.byKey(const Key('check-health-btn'));
    expect(button, findsOneWidget);
    await tester.tap(button);

    // Wait for HTTP response — pump with timeout
    await tester.pumpAndSettle(const Duration(seconds: 10));

    // Verify the status text shows "ok"
    final statusText = find.byKey(const Key('health-status'));
    expect(statusText, findsOneWidget);
    expect(find.text('ok'), findsOneWidget);
  });
}
