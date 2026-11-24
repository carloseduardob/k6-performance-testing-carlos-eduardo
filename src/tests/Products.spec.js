import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/latest/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

export const getProductsListDuration = new Trend('get_products_list', true);
export const getProductByIdDuration = new Trend('get_product_by_id', true);
export const RateListOK = new Rate('list_OK');
export const RateDetailOK = new Rate('detail_OK');

export const options = {
  thresholds: {
    http_req_duration: ['p(90)<6800'],
    http_req_failed: ['rate<0.25']
  },
  startVUs: 7,
  stages: [
    { duration: '30s', target: 7 },
    { duration: '40s', target: 30 },
    { duration: '50s', target: 60 },
    { duration: '50s', target: 92 },
    { duration: '20s', target: 92 },
    { duration: '20s', target: 0 }
  ]
};

export function handleSummary(data) {
  return {
    './src/output/products.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true })
  };
}

function parseJson(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

export default function () {
  const baseUrl = 'https://dummyjson.com/products';

  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const OK = 200;
  let productId = 1;

  group('List products', () => {
    const res = http.get(`${baseUrl}?limit=10`, params);

    getProductsListDuration.add(res.timings.duration);

    const body = parseJson(res);
    const isListOK =
      res.status === OK &&
      body !== null &&
      Array.isArray(body.products) &&
      body.products.length > 0;

    RateListOK.add(isListOK);

    check(res, {
      'GET Products - Status 200': () => res.status === OK,
      'GET Products - Returns a non-empty list': () => isListOK
    });

    if (isListOK) {
      productId =
        body.products[Math.floor(Math.random() * body.products.length)].id;
    }
  });

  sleep(1);

  group('Get product by id', () => {
    const res = http.get(`${baseUrl}/${productId}`, params);

    getProductByIdDuration.add(res.timings.duration);

    const body = parseJson(res);
    const isDetailOK =
      res.status === OK &&
      body !== null &&
      body.id === productId &&
      body.title !== undefined;

    RateDetailOK.add(isDetailOK);

    check(res, {
      'GET Product by id - Status 200': () => res.status === OK,
      'GET Product by id - Returns matching id and title': () => isDetailOK
    });
  });

  sleep(1);
}