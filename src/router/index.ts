import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      props: { name: undefined },
    },
    {
      path: '/:name',
      name: 'user',
      component: HomeView,
      props: true,
    },
  ],
})

export default router
