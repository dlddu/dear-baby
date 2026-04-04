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

    // Poll until the health status text appears (HTTP response is async)
    final statusFinder = find.byKey(const Key('health-status'));
    for (int i = 0; i < 100; i++) {
      await tester.pump(const Duration(milliseconds: 200));
      if (statusFinder.evaluate().isNotEmpty) {
        break;
      }
    }

    // Verify the status text shows "ok"
    expect(statusFinder, findsOneWidget);
    expect(find.text('ok'), findsOneWidget);
  });
}
