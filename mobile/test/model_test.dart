import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/models.dart';

void main() {
  test('formats currency and sort labels', () {
    expect(formatMoney(24999), contains('24'));
    expect(SearchSort.newest.label, 'En yeni');
    expect(SearchSort.lowestPrice.label, 'En ucuz');
  });
}
